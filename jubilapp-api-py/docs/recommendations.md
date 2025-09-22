Recomendaciones atemporales
===========================

Fuente de datos
---------------
- El catálogo curado se encuentra en `app/domain_activities.py` como `ATEMPORAL_ACTIVITIES`.
- Cada actividad tiene: `id`, `title`, `emoji`, `tags` (nombres del catálogo de intereses), `indoor`, `energy`, `duration_min`, `cost`, `time_of_day` y `suggested_time` opcional.

API
---
- Endpoint: `GET /api/recommendations/atemporales?limit=8&tod=manana|tarde|noche|cualquiera`.
- Usa intereses del usuario (`users.interests` o `interest_ids`) y su `preparation_level` para calcular un score.

Cómo agregar/editar actividades
-------------------------------
1. Editar la lista `ATEMPORAL_ACTIVITIES` y mantener `tags` alineados con los nombres del catálogo en `app/routers/interests.py`.
2. Opcional: ajustar los pesos en `recommend_atemporales` para afinar la priorización.

Notas
-----
- La lógica es determinista salvo por un ligero ruido aleatorio para diversidad.
- Si en el futuro se quiere integrar un motor externo (p. ej. BERT), se puede reemplazar la implementación de `recommend_atemporales` sin tocar el contrato del endpoint.

