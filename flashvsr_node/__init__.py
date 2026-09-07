"""FlashVSR node package.

Registering the `toobusy_flashvsr` model folder touches the filesystem at import
time. That is a convenience, not a requirement, so a read-only or missing models
directory must not stop the nodes from loading.
"""

import logging
import os

import folder_paths

logger = logging.getLogger(__name__)

try:
    model_dir = os.path.join(folder_paths.models_dir, "FlashVSR")
    os.makedirs(model_dir, exist_ok=True)
    folder_paths.add_model_folder_path("toobusy_flashvsr", model_dir)
except OSError as exc:
    logger.warning(
        "[toobusy] could not prepare the FlashVSR model folder (%s: %s); "
        "place the checkpoints under models/FlashVSR manually.",
        type(exc).__name__,
        exc,
    )

from .nodes import NODE_CLASS_MAPPINGS, NODE_DISPLAY_NAME_MAPPINGS

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS"]
