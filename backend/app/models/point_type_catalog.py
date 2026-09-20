from uuid import UUID

LITERARY_POINT_TYPE_ID = UUID("11111111-1111-4111-8111-111111111111")
READING_POINT_TYPE_ID = UUID("22222222-2222-4222-8222-222222222222")

POINT_TYPE_ICONS = frozenset(
    {
        "book-open",
        "library",
        "landmark",
        "headphones",
        "map-pin",
        "trees",
        "coffee",
        "info",
    }
)

POINT_TYPE_COLORS = frozenset(
    {
        "#C45732",
        "#2F6F68",
        "#76507A",
        "#2D6EA3",
        "#8A6518",
        "#4F6B3A",
        "#6F5147",
        "#4D5965",
    }
)

DEFAULT_POINT_TYPES = (
    {
        "id": LITERARY_POINT_TYPE_ID,
        "slug": "literary",
        "name_pt": "Ponto literário",
        "icon_key": "book-open",
        "color": "#C45732",
        "sort_order": 10,
        "is_active": True,
    },
    {
        "id": READING_POINT_TYPE_ID,
        "slug": "reading",
        "name_pt": "Ponto de leitura",
        "icon_key": "library",
        "color": "#2F6F68",
        "sort_order": 20,
        "is_active": True,
    },
)
