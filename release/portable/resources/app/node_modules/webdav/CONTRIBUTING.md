# Contribution guide

## Issues and Questions
When making an issue for **webdav-client**, be sure to be respectful and kind - this is free software built on peoples' spare time. Please do not assume that any or all of your requests will be met, and try to be as clear as possible when communicating.

You should include all necessary information relating to potential bugs - unclear or non-constructive issues will be closed without notice. If a bug report details a fault with some part of the processing, sending or receiving of files or data you should include a test case of some sort, using [webdav-server](https://www.npmjs.com/package/webdav-server) as the webdav server. We cannot test against your WebDAV services or accounts in most cases, so issues should be reproduced openly.

## Pull Requests
When making a pull request for an existing issue or feature that is clearly beneficial (subject to opinion), make sure that all tests pass before pushing. No pull request will be accepted that has failing tests. Although some commands relating to testing or formatting may not work on some operating systems (like Windows0), it is **your** responsibility to ensure the code is formatted correctly.

When making a pull request for an item not listed as an issue or that is controversial (also subject to opinion), be aware that the request may be denied and the PR closed. It is always best to create an issue for a discussion before making a PR, if you are unsure of the feature's worth.

## Documentation
PRs to add/update documentation are welcome, but please, ensure that you edit in **Markdown** with as little HTML as possible (none is preferable). Do not use auto-formatters to generate the documentation files.

`API.md` is generated on release - there is no need to update it yourself.

## Development Support
Please note that only **Linux** and **Mac** are supported as development environments. No commands that form part of the development cycle are guaranteed to work on Windows, for instance.
