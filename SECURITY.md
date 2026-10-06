# Security

This is a static site: no backend, no accounts, no user data, no cookies or storage. Runtime requests go to the host that serves the page and to OpenFreeMap for the basemap. Application and civic record text comes from City of Surrey open data and is HTML-escaped before display; outbound links are limited to http and https URLs.

To report a problem, open a GitHub issue marked "security" or email the address on https://parallexlabs.ca/. Please do not include exploit details in a public issue; we will reply with a private channel.

Dependencies are pinned in `package-lock.json`, checked by `npm audit` in CI, and updated through Dependabot.
