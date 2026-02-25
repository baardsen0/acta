# acta

Purpose: capture and track log entries with consistent fields, configurable time display, and clear ownership.

## Run

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Open: http://127.0.0.1:5003

## Run With Docker Compose

```bash
mkdir -p data
docker compose up --build
```

Open: http://127.0.0.1:5003

Data is persisted to `./data/acta.jsonl`.

Stop:

```bash
docker compose down
```

## How To Use

1. Open the app in your browser.
2. Use tabs at the top:
   - `Entry`: create log entries
   - `Entries`: view, search, page, and export entries
   - `Settings`: configure date format and default user
3. In `Settings`, choose:
   - `Date format`: `24-hour` or `AM/PM`
   - `Export format`: `MD` (default), `PDF`, `XLS`, or `JSON`
   - `User name`: default value for `Created by`
4. In `Entry`, fill fields and click `Save entry`.
5. Review saved records in `Logged Entries`.
6. Use search, pagination (`Prev`/`Next`), or `Export`.

## UI Helpers

- `Use current time`: fills the date/time fields based on selected format.
- `Use example values`: prefills a sample entry you can edit.
- Tooltips (`?`): field-level descriptions in the form.
- Toast notifications: validation, API, and network errors are shown as toast messages.
- Logged entries are shown newest-first, 5 per page.
- Search filters entries client-side across visible fields.
- Export downloads all entries in the selected export format.

## Notes

- API base: `/api`
- Export API: `/api/export?format=md|pdf|xls|json`
- Frontend files are in `frontend/`
- Backend storage file: `acta.jsonl` (JSON Lines)
- Optional env var: `ACTA_DATA_FILE` to override storage location.
- Backend logs include request flow, validation warnings, and exception traces.

## Stored fields

- `id` (incremental integer)
- `what` (text)
- `when_at` (datetime string: `YYYY-MM-DD HH:MM:SS`)
- `where_location` (text, surfaced as `where` in API/UI)
- `who` (text, comma-separated)
- `created_at` (datetime string)
- `created_by` (text)

## License

Free to use and modify for personal and commercial purposes.

## Author

Freddy Baardsen
