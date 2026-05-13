## 2024-05-13 - [HTML Responses]
**Learning:** Even simple API-generated HTML responses (like the `/api/v1/whatsapp/qr` endpoint) can fail basic accessibility checks if they lack a `<title>`, `lang` attribute, or `viewport` meta tag. Missing these can severely impair mobile rendering and screen reader comprehension.
**Action:** Always ensure that dynamically constructed HTML strings returned via generic Response objects include the proper `<head>` boilerplates.
