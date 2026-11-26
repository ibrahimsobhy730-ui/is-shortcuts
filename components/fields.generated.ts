/* GENERATED — do not edit by hand. Run `bun run gen:fields` to
   regenerate from lib/actions.ts (the request schemas are the source
   of truth, so the page and the server can never disagree about a
   field's limits). */

export const FIELDS = {
  "register": {
    "name": {
      "name": "name",
      "minLength": 2,
      "required": true,
      "maxLength": 80
    },
    "email": {
      "name": "email",
      "minLength": 5,
      "required": true,
      "maxLength": 120
    },
    "phone": {
      "name": "phone",
      "maxLength": 20
    },
    "password": {
      "name": "password",
      "minLength": 1,
      "required": true,
      "maxLength": 100
    }
  },
  "login": {
    "identifier": {
      "name": "identifier",
      "minLength": 3,
      "required": true,
      "maxLength": 120
    },
    "password": {
      "name": "password",
      "minLength": 1,
      "required": true,
      "maxLength": 100
    }
  },
  "restoreOwnerAccess": {
    "email": {
      "name": "email",
      "minLength": 5,
      "required": true,
      "maxLength": 120
    },
    "password": {
      "name": "password",
      "minLength": 1,
      "required": true,
      "maxLength": 100
    },
    "key": {
      "name": "key",
      "minLength": 1,
      "required": true,
      "maxLength": 200
    }
  },
  "setEmail": {
    "token": {
      "name": "token"
    },
    "email": {
      "name": "email",
      "minLength": 5,
      "required": true,
      "maxLength": 120
    }
  },
  "logout": {
    "token": {
      "name": "token"
    }
  },
  "logoutAll": {
    "token": {
      "name": "token"
    }
  },
  "me": {
    "token": {
      "name": "token"
    }
  },
  "updateProfile": {
    "token": {
      "name": "token"
    },
    "name": {
      "name": "name",
      "minLength": 2,
      "required": true,
      "maxLength": 80
    }
  },
  "setAvatar": {
    "token": {
      "name": "token"
    },
    "dataBase64": {
      "name": "dataBase64",
      "minLength": 1,
      "required": true,
      "maxLength": 2800000
    },
    "mimeType": {
      "name": "mimeType"
    }
  },
  "removeAvatar": {
    "token": {
      "name": "token"
    }
  },
  "exportFullBackup": {
    "token": {
      "name": "token"
    }
  },
  "resetUsageStats": {
    "token": {
      "name": "token"
    }
  },
  "changePassword": {
    "token": {
      "name": "token"
    },
    "currentPassword": {
      "name": "currentPassword",
      "minLength": 1,
      "required": true,
      "maxLength": 100
    },
    "newPassword": {
      "name": "newPassword",
      "minLength": 1,
      "required": true,
      "maxLength": 100
    }
  },
  "linkGoogle": {
    "token": {
      "name": "token"
    },
    "email": {
      "name": "email",
      "minLength": 5,
      "required": true,
      "maxLength": 120
    }
  },
  "unlinkGoogle": {
    "token": {
      "name": "token"
    }
  },
  "listShortcuts": {
    "token": {
      "name": "token"
    }
  },
  "createShortcut": {
    "token": {
      "name": "token"
    },
    "title": {
      "name": "title",
      "minLength": 1,
      "required": true,
      "maxLength": 200
    },
    "body": {
      "name": "body",
      "minLength": 1,
      "required": true,
      "maxLength": 20000
    },
    "category": {
      "name": "category",
      "minLength": 1,
      "required": true,
      "maxLength": 60
    },
    "tags": {
      "name": "tags",
      "maxLength": 300
    },
    "trigger": {
      "name": "trigger",
      "maxLength": 24
    },
    "extShortcut": {
      "name": "extShortcut",
      "maxLength": 60
    },
    "source": {
      "name": "source"
    },
    "folderId": {
      "name": "folderId",
      "type": "number",
      "step": 1,
      "min": 1
    }
  },
  "updateShortcut": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "title": {
      "name": "title",
      "minLength": 1,
      "required": true,
      "maxLength": 200
    },
    "body": {
      "name": "body",
      "minLength": 1,
      "required": true,
      "maxLength": 20000
    },
    "category": {
      "name": "category",
      "minLength": 1,
      "required": true,
      "maxLength": 60
    },
    "tags": {
      "name": "tags",
      "maxLength": 300
    },
    "trigger": {
      "name": "trigger",
      "maxLength": 24
    },
    "extShortcut": {
      "name": "extShortcut",
      "maxLength": 60
    },
    "source": {
      "name": "source"
    },
    "folderId": {
      "name": "folderId",
      "type": "number",
      "step": 1,
      "min": 1
    }
  },
  "deleteShortcut": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "toggleFavorite": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "favorite": {
      "name": "favorite"
    }
  },
  "togglePin": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "pinned": {
      "name": "pinned"
    }
  },
  "recordUse": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "listCopyHistory": {
    "token": {
      "name": "token"
    }
  },
  "clearCopyHistory": {
    "token": {
      "name": "token"
    }
  },
  "duplicateShortcut": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "importShortcuts": {
    "token": {
      "name": "token"
    },
    "items": {
      "title": {
        "name": "title",
        "minLength": 1,
        "maxLength": 200
      },
      "body": {
        "name": "body",
        "minLength": 1,
        "maxLength": 20000
      },
      "category": {
        "name": "category",
        "minLength": 1,
        "maxLength": 60
      },
      "tags": {
        "name": "tags",
        "maxLength": 300
      },
      "trigger": {
        "name": "trigger",
        "maxLength": 24
      },
      "extShortcut": {
        "name": "extShortcut",
        "maxLength": 60
      },
      "source": {
        "name": "source"
      }
    },
    "mode": {
      "name": "mode"
    }
  },
  "loadStarterPack": {
    "token": {
      "name": "token"
    }
  },
  "importContentPackForOwner": {},
  "listFolders": {
    "token": {
      "name": "token"
    }
  },
  "createFolder": {
    "token": {
      "name": "token"
    },
    "name": {
      "name": "name",
      "minLength": 1,
      "required": true,
      "maxLength": 60
    },
    "parentId": {
      "name": "parentId",
      "type": "number",
      "step": 1,
      "min": 1
    },
    "description": {
      "name": "description",
      "maxLength": 300
    },
    "icon": {
      "name": "icon",
      "maxLength": 40
    },
    "iconColor": {
      "name": "iconColor",
      "maxLength": 20
    },
    "shortcutIds": {
      "name": "shortcutIds",
      "type": "number",
      "step": 1,
      "min": 1
    }
  },
  "renameFolder": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "name": {
      "name": "name",
      "minLength": 1,
      "required": true,
      "maxLength": 60
    },
    "description": {
      "name": "description",
      "maxLength": 300
    },
    "icon": {
      "name": "icon",
      "maxLength": 40
    },
    "iconColor": {
      "name": "iconColor",
      "maxLength": 20
    }
  },
  "toggleFolderPin": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "pinned": {
      "name": "pinned"
    }
  },
  "setFolderSource": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "source": {
      "name": "source"
    }
  },
  "deleteFolder": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "moveFolder": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "newParentId": {
      "name": "newParentId",
      "type": "number",
      "step": 1,
      "min": 1
    },
    "orderedSiblingIds": {
      "name": "orderedSiblingIds",
      "type": "number",
      "step": 1,
      "min": 1
    }
  },
  "moveShortcut": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "targetFolderId": {
      "name": "targetFolderId",
      "type": "number",
      "step": 1,
      "min": 1
    },
    "orderedIds": {
      "name": "orderedIds",
      "type": "number",
      "step": 1,
      "min": 1
    }
  },
  "moveShortcuts": {
    "token": {
      "name": "token"
    },
    "ids": {
      "name": "ids",
      "type": "number",
      "step": 1,
      "min": 1
    },
    "targetFolderId": {
      "name": "targetFolderId",
      "type": "number",
      "step": 1,
      "min": 1
    }
  },
  "listTrash": {
    "token": {
      "name": "token"
    }
  },
  "restoreShortcut": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "deleteShortcutForever": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "restoreFolder": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "deleteFolderForever": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "emptyTrash": {
    "token": {
      "name": "token"
    }
  },
  "duplicateFolder": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "bulkUpdateShortcuts": {
    "token": {
      "name": "token"
    },
    "ids": {
      "name": "ids",
      "type": "number",
      "step": 1,
      "min": 1
    },
    "op": {
      "name": "op"
    },
    "tag": {
      "name": "tag",
      "maxLength": 60
    }
  },
  "listSmartFolders": {
    "token": {
      "name": "token"
    }
  },
  "createSmartFolder": {
    "token": {
      "name": "token"
    },
    "name": {
      "name": "name",
      "minLength": 1,
      "required": true,
      "maxLength": 60
    },
    "icon": {
      "name": "icon",
      "maxLength": 40
    },
    "iconColor": {
      "name": "iconColor",
      "maxLength": 20
    },
    "tags": {
      "name": "tags",
      "maxLength": 300
    },
    "folderId": {
      "name": "folderId",
      "type": "number",
      "step": 1,
      "min": 1
    },
    "pinnedOnly": {
      "name": "pinnedOnly"
    },
    "favoriteOnly": {
      "name": "favoriteOnly"
    },
    "minUses": {
      "name": "minUses",
      "type": "number",
      "step": 1,
      "min": 0,
      "max": 100000
    },
    "unusedDays": {
      "name": "unusedDays",
      "type": "number",
      "step": 1,
      "min": 1,
      "max": 3650
    }
  },
  "updateSmartFolder": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    },
    "name": {
      "name": "name",
      "minLength": 1,
      "required": true,
      "maxLength": 60
    },
    "icon": {
      "name": "icon",
      "maxLength": 40
    },
    "iconColor": {
      "name": "iconColor",
      "maxLength": 20
    },
    "tags": {
      "name": "tags",
      "maxLength": 300
    },
    "folderId": {
      "name": "folderId",
      "type": "number",
      "step": 1,
      "min": 1
    },
    "pinnedOnly": {
      "name": "pinnedOnly"
    },
    "favoriteOnly": {
      "name": "favoriteOnly"
    },
    "minUses": {
      "name": "minUses",
      "type": "number",
      "step": 1,
      "min": 0,
      "max": 100000
    },
    "unusedDays": {
      "name": "unusedDays",
      "type": "number",
      "step": 1,
      "min": 1,
      "max": 3650
    }
  },
  "deleteSmartFolder": {
    "token": {
      "name": "token"
    },
    "id": {
      "name": "id",
      "type": "number",
      "step": 1,
      "required": true,
      "min": 1
    }
  },
  "applyTreeOrder": {
    "token": {
      "name": "token"
    },
    "folders": {
      "id": {
        "name": "id",
        "type": "number",
        "step": 1,
        "min": 1
      },
      "parentId": {
        "name": "parentId",
        "type": "number",
        "step": 1,
        "min": 1
      },
      "sortOrder": {
        "name": "sortOrder",
        "type": "number",
        "step": 1,
        "min": 0,
        "max": 100000
      }
    },
    "shortcuts": {
      "id": {
        "name": "id",
        "type": "number",
        "step": 1,
        "min": 1
      },
      "folderId": {
        "name": "folderId",
        "type": "number",
        "step": 1,
        "min": 1
      },
      "category": {
        "name": "category",
        "minLength": 1,
        "maxLength": 60
      },
      "sortOrder": {
        "name": "sortOrder",
        "type": "number",
        "step": 1,
        "min": 0,
        "max": 100000
      }
    }
  }
} as const;
