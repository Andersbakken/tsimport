To use:

```git clone git@github.com:Andersbakken/tsimport.git
cd tsimport
npm install
npm run build
export PATH="$PATH:$PWD/bin"
```

### in emacs

```
(add-to-list 'load-path "/path/to/tsimport/src")
(require 'tsimport)
(define-key typescript-mode-map (kbd "C-c I") (function tsimport))
(define-key tide-mode-map (kbd "C-c I") (function tsimport))
```
