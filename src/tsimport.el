(require 'thingatpt)

(defvar ts-import-command "node /home/abakken/dev/tsimport/dist/tsimport.js")
(defvar ts-import-backup-suffix nil)
(defun ts-import (&optional symbol)
  (interactive)
  (unless symbol
    (let ((default (thing-at-point 'symbol))
          (alternatives (split-string (shell-command-to-string (format "%s %s --complete" ts-import-command (buffer-file-name))))))
      (setq symbol (completing-read (if default (format "Symbol (default %s): " default) "Symbol: ") alternatives))
      (when (string= symbol "")
        (unless default
          (error "No default"))
        (setq symbol default))))
  (shell-command-to-string (format "%s %s %s -i%s"
                                   ts-import-command
                                   (buffer-file-name)
                                   symbol
                                   (if ts-import-backup-suffix
                                       (concat "=" ts-import-backup-suffix)
                                     ""))))
  ;; (message "symbol %s" symbol))

(provide 'ts-import)
