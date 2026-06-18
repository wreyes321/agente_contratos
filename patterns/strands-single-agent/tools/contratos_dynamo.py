"""Herramienta de consulta estructurada a DynamoDB para contratos agrícolas.

Permite filtrar contratos por proveedor, estado, tipo, rangos de fecha y montos.
Los filtros se combinan con AND logic. Usa GSIs para queries eficientes por
estado y proveedor.
"""

import json
import logging
import os
import re
from datetime import date
from decimal import Decimal
from typing import Optional

import boto3
from boto3.dynamodb.conditions import Attr, Key
from strands import tool

logger = logging.getLogger(__name__)

VALID_ESTADOS = {"vigente", "vencido", "por_vencer"}
ISO_DATE_PATTERN = r"^\d{4}-\d{2}-\d{2}$"


class DecimalEncoder(json.JSONEncoder):
    """JSON encoder that handles Decimal types from DynamoDB."""

    def default(self, o: object) -> object:
        """Convert Decimal to int or float for JSON serialization.

        Args:
            o: Object to serialize.

        Returns:
            Serializable representation of the object.
        """
        if isinstance(o, Decimal):
            if o % 1 == 0:
                return int(o)
            return float(o)
        return super().default(o)


def _validate_estado(estado: str) -> str | None:
    """Validate that estado is a valid contract status.

    Args:
        estado: Status value to validate.

    Returns:
        Error message if invalid, None if valid.
    """
    if estado.lower() not in VALID_ESTADOS:
        return (
            f"Estado inválido: '{estado}'. "
            f"Valores permitidos: {', '.join(sorted(VALID_ESTADOS))}"
        )
    return None


def _validate_date(date_str: str) -> str | None:
    """Validate that a string is a valid ISO 8601 date (YYYY-MM-DD).

    Args:
        date_str: Date string to validate.

    Returns:
        Error message if invalid, None if valid.
    """
    if not re.match(ISO_DATE_PATTERN, date_str):
        return f"Formato de fecha inválido: '{date_str}'. Use AAAA-MM-DD"
    try:
        date.fromisoformat(date_str)
    except ValueError:
        return f"Fecha inválida: '{date_str}'. Verifique que sea una fecha real"
    return None


def _build_filter_expression(
    tipo_contrato: Optional[str],
    fecha_inicio_desde: Optional[str],
    fecha_inicio_hasta: Optional[str],
    fecha_vencimiento_desde: Optional[str],
    fecha_vencimiento_hasta: Optional[str],
    monto_minimo: Optional[float],
    monto_maximo: Optional[float],
    exclude_key: Optional[str] = None,
) -> Optional[object]:
    """Build a DynamoDB FilterExpression from the provided filters.

    Combines all non-None filters with AND logic. Excludes the field specified
    in exclude_key (used when that field is already in a KeyConditionExpression).

    Args:
        tipo_contrato: Contract type filter.
        fecha_inicio_desde: Minimum start date (ISO 8601).
        fecha_inicio_hasta: Maximum start date (ISO 8601).
        fecha_vencimiento_desde: Minimum expiration date (ISO 8601).
        fecha_vencimiento_hasta: Maximum expiration date (ISO 8601).
        monto_minimo: Minimum contract amount.
        monto_maximo: Maximum contract amount.
        exclude_key: Field name to exclude from filter (already used as key condition).

    Returns:
        Combined FilterExpression or None if no filters apply.
    """
    conditions = []

    if tipo_contrato and exclude_key != "tipo_contrato":
        conditions.append(Attr("tipo_contrato").eq(tipo_contrato))

    if fecha_inicio_desde:
        conditions.append(Attr("fecha_inicio").gte(fecha_inicio_desde))
    if fecha_inicio_hasta:
        conditions.append(Attr("fecha_inicio").lte(fecha_inicio_hasta))

    if fecha_vencimiento_desde:
        conditions.append(Attr("fecha_vencimiento").gte(fecha_vencimiento_desde))
    if fecha_vencimiento_hasta:
        conditions.append(Attr("fecha_vencimiento").lte(fecha_vencimiento_hasta))

    if monto_minimo is not None:
        conditions.append(Attr("monto").gte(Decimal(str(monto_minimo))))
    if monto_maximo is not None:
        conditions.append(Attr("monto").lte(Decimal(str(monto_maximo))))

    if not conditions:
        return None

    # Combine all conditions with AND
    expression = conditions[0]
    for condition in conditions[1:]:
        expression = expression & condition
    return expression


@tool
def consultar_contratos_dynamo(
    proveedor: Optional[str] = None,
    estado: Optional[str] = None,
    tipo_contrato: Optional[str] = None,
    fecha_inicio_desde: Optional[str] = None,
    fecha_inicio_hasta: Optional[str] = None,
    fecha_vencimiento_desde: Optional[str] = None,
    fecha_vencimiento_hasta: Optional[str] = None,
    monto_minimo: Optional[float] = None,
    monto_maximo: Optional[float] = None,
) -> str:
    """Consulta contratos en DynamoDB por criterios estructurados.

    Permite filtrar contratos por proveedor, estado, tipo, rangos de fecha
    y rangos de monto. Todos los filtros son opcionales y se combinan con AND.

    Args:
        proveedor: Nombre del proveedor a filtrar.
        estado: Estado del contrato ("vigente", "vencido", "por_vencer").
        tipo_contrato: Tipo de contrato a filtrar.
        fecha_inicio_desde: Fecha inicio mínima (ISO 8601, ej: "2024-01-01").
        fecha_inicio_hasta: Fecha inicio máxima (ISO 8601).
        fecha_vencimiento_desde: Fecha vencimiento mínima (ISO 8601).
        fecha_vencimiento_hasta: Fecha vencimiento máxima (ISO 8601).
        monto_minimo: Monto mínimo del contrato.
        monto_maximo: Monto máximo del contrato.

    Returns:
        JSON string con la lista de contratos que cumplen los filtros,
        o mensaje indicando que no se encontraron resultados.
    """
    # --- Input validation ---
    if estado:
        error = _validate_estado(estado)
        if error:
            return json.dumps({"error": error}, ensure_ascii=False)

    for date_val, label in [
        (fecha_inicio_desde, "fecha_inicio_desde"),
        (fecha_inicio_hasta, "fecha_inicio_hasta"),
        (fecha_vencimiento_desde, "fecha_vencimiento_desde"),
        (fecha_vencimiento_hasta, "fecha_vencimiento_hasta"),
    ]:
        if date_val:
            error = _validate_date(date_val)
            if error:
                return json.dumps({"error": error}, ensure_ascii=False)

    if monto_minimo is not None and monto_maximo is not None:
        if monto_minimo > monto_maximo:
            return json.dumps(
                {"error": "El monto mínimo no puede ser mayor al máximo"},
                ensure_ascii=False,
            )

    # --- Build query ---
    table_name = os.environ.get("CONTRATOS_TABLE_NAME")
    if not table_name:
        raise ValueError("CONTRATOS_TABLE_NAME environment variable is required")

    dynamodb_resource = boto3.resource(
        "dynamodb",
        region_name=os.environ.get("AWS_DEFAULT_REGION", "us-east-1"),
    )
    table = dynamodb_resource.Table(table_name)

    # Track applied filters for the response
    filtros_aplicados = {}
    if proveedor:
        filtros_aplicados["proveedor"] = proveedor
    if estado:
        filtros_aplicados["estado"] = estado
    if tipo_contrato:
        filtros_aplicados["tipo_contrato"] = tipo_contrato
    if fecha_inicio_desde:
        filtros_aplicados["fecha_inicio_desde"] = fecha_inicio_desde
    if fecha_inicio_hasta:
        filtros_aplicados["fecha_inicio_hasta"] = fecha_inicio_hasta
    if fecha_vencimiento_desde:
        filtros_aplicados["fecha_vencimiento_desde"] = fecha_vencimiento_desde
    if fecha_vencimiento_hasta:
        filtros_aplicados["fecha_vencimiento_hasta"] = fecha_vencimiento_hasta
    if monto_minimo is not None:
        filtros_aplicados["monto_minimo"] = monto_minimo
    if monto_maximo is not None:
        filtros_aplicados["monto_maximo"] = monto_maximo

    try:
        # Determine query strategy: GSI query vs table scan
        if estado:
            # Use estado-index GSI
            filter_expr = _build_filter_expression(
                tipo_contrato=tipo_contrato,
                fecha_inicio_desde=fecha_inicio_desde,
                fecha_inicio_hasta=fecha_inicio_hasta,
                fecha_vencimiento_desde=fecha_vencimiento_desde,
                fecha_vencimiento_hasta=fecha_vencimiento_hasta,
                monto_minimo=monto_minimo,
                monto_maximo=monto_maximo,
            )
            # Add proveedor as filter since it's not the key condition here
            if proveedor:
                proveedor_condition = Attr("proveedor").eq(proveedor)
                filter_expr = (
                    (filter_expr & proveedor_condition)
                    if filter_expr
                    else proveedor_condition
                )

            query_params = {
                "IndexName": "estado-index",
                "KeyConditionExpression": Key("estado").eq(estado.lower()),
            }
            if filter_expr:
                query_params["FilterExpression"] = filter_expr

            response = table.query(**query_params)
            items = response.get("Items", [])

        elif proveedor:
            # Use proveedor-index GSI
            filter_expr = _build_filter_expression(
                tipo_contrato=tipo_contrato,
                fecha_inicio_desde=fecha_inicio_desde,
                fecha_inicio_hasta=fecha_inicio_hasta,
                fecha_vencimiento_desde=fecha_vencimiento_desde,
                fecha_vencimiento_hasta=fecha_vencimiento_hasta,
                monto_minimo=monto_minimo,
                monto_maximo=monto_maximo,
            )

            query_params = {
                "IndexName": "proveedor-index",
                "KeyConditionExpression": Key("proveedor").eq(proveedor),
            }
            if filter_expr:
                query_params["FilterExpression"] = filter_expr

            response = table.query(**query_params)
            items = response.get("Items", [])

        else:
            # Table scan with filters
            filter_expr = _build_filter_expression(
                tipo_contrato=tipo_contrato,
                fecha_inicio_desde=fecha_inicio_desde,
                fecha_inicio_hasta=fecha_inicio_hasta,
                fecha_vencimiento_desde=fecha_vencimiento_desde,
                fecha_vencimiento_hasta=fecha_vencimiento_hasta,
                monto_minimo=monto_minimo,
                monto_maximo=monto_maximo,
            )

            scan_params = {}
            if filter_expr:
                scan_params["FilterExpression"] = filter_expr

            response = table.scan(**scan_params)
            items = response.get("Items", [])

    except Exception as e:
        logger.exception("Error querying DynamoDB contratos table")
        return json.dumps(
            {"error": f"Error al consultar la base de datos: {str(e)}"},
            ensure_ascii=False,
        )

    # --- Format response ---
    if not items:
        return json.dumps(
            {
                "contratos": [],
                "total": 0,
                "filtros_aplicados": filtros_aplicados,
                "mensaje": "No se encontraron contratos con los filtros especificados.",
            },
            ensure_ascii=False,
            cls=DecimalEncoder,
        )

    return json.dumps(
        {
            "contratos": items,
            "total": len(items),
            "filtros_aplicados": filtros_aplicados,
        },
        ensure_ascii=False,
        cls=DecimalEncoder,
    )
