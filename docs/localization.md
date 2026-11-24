# Localization and Formatting

> **Status: architecture prepared; English content begins with the feature phases.**

## Rules

- English is the only populated locale in the first release.
- UI text must use translation keys, not hardcoded strings.
- Backend errors return stable codes; the client maps them to translations.
- Translation files live under `src/client/locales`.
- A Burmese locale scaffold will be added but left unpopulated.
- PDFs and posters must be able to use translated strings later.
- Fonts must support Burmese script when that localization is added.

## Currency

- USD only.
- Format: `$1,234.56`.
- No currency conversion.

## Time

- App time zone default: `Asia/Yangon`.
- Trading time zone default: `America/New_York`.
- Store timestamps in UTC.
- Store date-only records as `YYYY-MM-DD` in the configured app time zone.
- Use IANA time zones and handle daylight-saving transitions.
- Monday is the first day of the week.

## Numbers

- Financial values are computed with integer units.
- Display formatting is centralized.
- Ratios and percentages use decimal arithmetic and rounded display values.
- Never infer missing values to make a formatted metric look complete.
