"""Script para poblar la tabla DynamoDB de contratos con datos de prueba.

Carga contratos de ejemplo que cubren todos los filtros: vigentes/vencidos/por_vencer,
múltiples proveedores, rangos de montos y fechas variadas.

Usage:
    python scripts/seed_contratos.py

Environment variables:
    CONTRATOS_TABLE_NAME: Nombre de la tabla DynamoDB (default: lee de stack outputs)
    AWS_DEFAULT_REGION: Región de AWS (default: us-east-1)
"""

import argparse
import json
import sys
from decimal import Decimal

import boto3

SAMPLE_CONTRATOS = [
    {
        "contrato_id": "C-2024-001",
        "proveedor": "AgroInsumos del Norte S.A.",
        "tipo_contrato": "suministro",
        "fecha_inicio": "2024-01-15",
        "fecha_vencimiento": "2025-01-15",
        "monto": Decimal("1500000.00"),
        "estado": "vigente",
        "s3_key": "contratos/C-2024-001.pdf",
    },
    {
        "contrato_id": "C-2024-002",
        "proveedor": "Fertilizantes del Pacífico",
        "tipo_contrato": "suministro",
        "fecha_inicio": "2024-03-01",
        "fecha_vencimiento": "2025-03-01",
        "monto": Decimal("2300000.00"),
        "estado": "vigente",
        "s3_key": "contratos/C-2024-002.pdf",
    },
    {
        "contrato_id": "C-2024-003",
        "proveedor": "Transportes Agrícolas CASSA",
        "tipo_contrato": "servicio",
        "fecha_inicio": "2024-02-01",
        "fecha_vencimiento": "2024-12-31",
        "monto": Decimal("800000.00"),
        "estado": "vencido",
        "s3_key": "contratos/C-2024-003.pdf",
    },
    {
        "contrato_id": "C-2024-004",
        "proveedor": "Maquinaria Agrícola del Bajío",
        "tipo_contrato": "arrendamiento",
        "fecha_inicio": "2024-06-01",
        "fecha_vencimiento": "2026-06-01",
        "monto": Decimal("5000000.00"),
        "estado": "vigente",
        "s3_key": "contratos/C-2024-004.pdf",
    },
    {
        "contrato_id": "C-2024-005",
        "proveedor": "AgroInsumos del Norte S.A.",
        "tipo_contrato": "suministro",
        "fecha_inicio": "2024-04-15",
        "fecha_vencimiento": "2024-10-15",
        "monto": Decimal("750000.00"),
        "estado": "vencido",
        "s3_key": "contratos/C-2024-005.pdf",
    },
    {
        "contrato_id": "C-2025-001",
        "proveedor": "Semillas Híbridas Nacionales",
        "tipo_contrato": "suministro",
        "fecha_inicio": "2025-01-01",
        "fecha_vencimiento": "2025-07-31",
        "monto": Decimal("1200000.00"),
        "estado": "por_vencer",
        "s3_key": "contratos/C-2025-001.pdf",
    },
    {
        "contrato_id": "C-2025-002",
        "proveedor": "Riego Tecnificado S.A. de C.V.",
        "tipo_contrato": "servicio",
        "fecha_inicio": "2025-02-01",
        "fecha_vencimiento": "2026-02-01",
        "monto": Decimal("3500000.00"),
        "estado": "vigente",
        "s3_key": "contratos/C-2025-002.pdf",
    },
    {
        "contrato_id": "C-2025-003",
        "proveedor": "Fertilizantes del Pacífico",
        "tipo_contrato": "suministro",
        "fecha_inicio": "2025-03-15",
        "fecha_vencimiento": "2025-09-15",
        "monto": Decimal("1800000.00"),
        "estado": "por_vencer",
        "s3_key": "contratos/C-2025-003.pdf",
    },
    {
        "contrato_id": "C-2025-004",
        "proveedor": "Laboratorio Agrícola Central",
        "tipo_contrato": "servicio",
        "fecha_inicio": "2025-01-10",
        "fecha_vencimiento": "2025-12-31",
        "monto": Decimal("450000.00"),
        "estado": "vigente",
        "s3_key": "contratos/C-2025-004.pdf",
    },
    {
        "contrato_id": "C-2025-005",
        "proveedor": "Seguros Agrícolas Protección",
        "tipo_contrato": "seguro",
        "fecha_inicio": "2025-04-01",
        "fecha_vencimiento": "2026-04-01",
        "monto": Decimal("980000.00"),
        "estado": "vigente",
        "s3_key": "contratos/C-2025-005.pdf",
    },
    {
        "contrato_id": "C-2023-001",
        "proveedor": "Transportes Agrícolas CASSA",
        "tipo_contrato": "servicio",
        "fecha_inicio": "2023-06-01",
        "fecha_vencimiento": "2024-05-31",
        "monto": Decimal("650000.00"),
        "estado": "vencido",
        "s3_key": "contratos/C-2023-001.pdf",
    },
    {
        "contrato_id": "C-2025-006",
        "proveedor": "Maquinaria Agrícola del Bajío",
        "tipo_contrato": "mantenimiento",
        "fecha_inicio": "2025-05-01",
        "fecha_vencimiento": "2025-08-01",
        "monto": Decimal("320000.00"),
        "estado": "por_vencer",
        "s3_key": "contratos/C-2025-006.pdf",
    },
]


def seed_contratos(table_name: str, region: str = "us-east-1") -> None:
    """Load sample contracts into the DynamoDB table.

    Args:
        table_name: Name of the DynamoDB table.
        region: AWS region.
    """
    dynamodb = boto3.resource("dynamodb", region_name=region)
    table = dynamodb.Table(table_name)

    print(f"Cargando {len(SAMPLE_CONTRATOS)} contratos en tabla: {table_name}")

    with table.batch_writer() as batch:
        for contrato in SAMPLE_CONTRATOS:
            batch.put_item(Item=contrato)
            print(f"  ✓ {contrato['contrato_id']} - {contrato['proveedor']}")

    print(f"\n✅ {len(SAMPLE_CONTRATOS)} contratos cargados exitosamente.")


def main() -> None:
    """Main entry point for the seed script."""
    parser = argparse.ArgumentParser(
        description="Poblar tabla DynamoDB de contratos con datos de prueba"
    )
    parser.add_argument(
        "--table-name",
        default=None,
        help="Nombre de la tabla DynamoDB (default: AgContratos-contratos)",
    )
    parser.add_argument(
        "--region",
        default="us-east-1",
        help="Región de AWS (default: us-east-1)",
    )
    args = parser.parse_args()

    table_name = args.table_name or "AgContratos-contratos"
    seed_contratos(table_name=table_name, region=args.region)


if __name__ == "__main__":
    main()
