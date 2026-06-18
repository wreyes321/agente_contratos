"""Herramienta de búsqueda semántica en Bedrock Knowledge Base para contratos.

Utiliza Amazon Bedrock Knowledge Base para encontrar cláusulas, términos,
condiciones y cualquier información textual dentro de los contratos almacenados.
"""

import json
import logging
import os
from typing import Optional

import boto3
from strands import tool

logger = logging.getLogger(__name__)


def _extract_contract_id_from_uri(s3_uri: str) -> str:
    """Extract a contract identifier from an S3 URI.

    Attempts to parse the S3 key to extract a meaningful contract ID.
    Falls back to the filename without extension.

    Args:
        s3_uri: The S3 URI from the Knowledge Base result (e.g. "s3://bucket/contratos/C-2024-001.pdf").

    Returns:
        A human-readable contract identifier string.
    """
    # Remove s3:// prefix and bucket name
    parts = s3_uri.replace("s3://", "").split("/", 1)
    if len(parts) < 2:
        return s3_uri

    key = parts[1]
    # Get filename without extension
    filename = key.rsplit("/", 1)[-1]
    name_without_ext = filename.rsplit(".", 1)[0]
    return name_without_ext


@tool
def buscar_contenido_contratos(query: str) -> str:
    """Busca información dentro del contenido de contratos usando búsqueda semántica.

    Utiliza Amazon Bedrock Knowledge Base para encontrar cláusulas, términos,
    condiciones y cualquier información textual dentro de los contratos.

    Args:
        query: Pregunta o términos de búsqueda en lenguaje natural.

    Returns:
        JSON string con los pasajes relevantes encontrados y sus referencias
        al contrato fuente, o mensaje indicando que no se encontró información.
    """
    if not query or not query.strip():
        return json.dumps(
            {"error": "Debe proporcionar un término de búsqueda"},
            ensure_ascii=False,
        )

    knowledge_base_id = os.environ.get("KNOWLEDGE_BASE_ID")
    if not knowledge_base_id:
        return json.dumps(
            {
                "error": "El servicio de búsqueda semántica no está configurado. "
                "KNOWLEDGE_BASE_ID no está definido."
            },
            ensure_ascii=False,
        )

    region = os.environ.get("AWS_DEFAULT_REGION", "us-east-1")

    try:
        client = boto3.client("bedrock-agent-runtime", region_name=region)

        response = client.retrieve(
            knowledgeBaseId=knowledge_base_id,
            retrievalQuery={"text": query.strip()},
        )

        results = response.get("retrievalResults", [])

        if not results:
            return json.dumps(
                {
                    "resultados": [],
                    "query": query,
                    "total_resultados": 0,
                    "mensaje": f"No se encontró información relevante en los contratos para: '{query}'",
                },
                ensure_ascii=False,
            )

        # Format results with source references
        formatted_results = []
        for result in results:
            content = result.get("content", {}).get("text", "")
            location = result.get("location", {})
            s3_location = location.get("s3Location", {})
            s3_uri = s3_location.get("uri", "")
            score = result.get("score", 0.0)

            contract_id = _extract_contract_id_from_uri(s3_uri) if s3_uri else "desconocido"

            formatted_results.append({
                "contenido": content,
                "contrato_fuente": contract_id,
                "relevancia": round(score, 3),
            })

        return json.dumps(
            {
                "resultados": formatted_results,
                "query": query,
                "total_resultados": len(formatted_results),
            },
            ensure_ascii=False,
        )

    except Exception as e:
        logger.exception("Error querying Bedrock Knowledge Base")
        return json.dumps(
            {"error": f"Error al buscar en la Knowledge Base: {str(e)}"},
            ensure_ascii=False,
        )
