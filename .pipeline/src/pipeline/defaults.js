// Ported from kg/config.py DEFAULTS; scope resolution is supplied by the host.
const PIPELINE_DEFAULTS = {
  "vault": ".",
  "vault_name": "",
  "include": [],
  "exclude": [],
  "exclude_notes": [],
  "scope_file": "",
  "scope": "",
  "scopes": {},
  "attachment_ext": [
    "png",
    "jpg",
    "jpeg",
    "gif",
    "svg",
    "webp",
    "bmp",
    "heic",
    "pdf",
    "mp4",
    "mov",
    "zip",
    "canvas",
    "drawio",
    "exe"
  ],
  "zoom": {
    "parent_dim": 0.22,
    "wheel_step": 1.18,
    "transition_ms": 260,
    "zoom_in_ceiling": 1.35,
    "zoom_out_floor": 1.05,
    "home_fit": 1.08,
    "home_level": 2,
    "home_band": 0.5
  },
  "weight": {
    "wiki_link": 1.0,
    "heading_link_bonus": 0.5,
    "embed_factor": 0.6,
    "annotation_default": 3.0
  },
  "candidates": {
    "enabled": true,
    "min_score": 0.45,
    "min_term_len": 3,
    "max_doc_freq_ratio": 0.25,
    "min_shared_terms": 2,
    "max_suggestions": 400,
    "generic_headings": []
  },
  "layout": {
    "leaf_radius": 1.0,
    "level_ratio": 1.5,
    "padding": 1.12,
    "size_exponent": 0.5,
    "norm_root_radius": 1000.0,
    "start_angle": -90
  },
  "lod": {
    "min_px": 18,
    "label_alpha": 0.55,
    "fade_span": 1.35,
    "focus_edge_dim": 0.07,
    "hover_edge_dim": 0.75,
    "idle_edge_dim": 0.45,
    "edge_trim_clearance": 2,
    "edge_marker_tint": 0.55,
    "raw_edge_width": 1.0,
    "raw_marker_min_len": 6,
    "ghost_alpha": 0.1,
    "ghost_label_alpha": 0.14,
    "ghost_label_min_px": 56,
    "label_font_min": 11,
    "label_font_max": 64,
    "label_font_scale": 0.3,
    "label_bold_depth": 2
  },
  "preview": {
    "enabled": true,
    "max_note_chars": 0,
    "total_chars_budget": 6000000
  },
  "theme": {
    "domains": {},
    "fallback": "#8B949E",
    "raw_edge": "#E6EDF3",
    "edge_color": "domain",
    "edge_tint": 0.52,
    "auto_palette": null
  },
  "output": {
    "json": "dist/graph.json",
    "html": "dist/knowledge-graph.html"
  },
  "annotations": "annotations.yaml",
  "candidates_file": "candidates.yaml"
};
