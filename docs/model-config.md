

## 1. Canonical Model Store Path

```
~/.BudgetCoder/models.json
```

| Platform | Actual path |
|---|---|
| Windows | `C:\Users\{user}\.BudgetCoder\config\models.json` |
| macOS | `/Users/{user}/.BudgetCoder/models.json` |
| Linux | `/home/{user}/.BudgetCoder/models.json` |

---

## 2. models.json Schema

The file is a **JSON array** of model objects:

```json
[
  {
    "name": "MiniMax-M2.7",
    "modelId": "MiniMax-M2.7",
    "baseUrl": "https://api.minimaxi.com/v1",
    "apiKey": "sk-...",
    "anthropicUrl": "https://api.minimaxi.com/anthropic",
  }
]
```