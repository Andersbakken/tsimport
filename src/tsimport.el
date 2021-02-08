(require 'thingatpt)

(defvar tsimport-command "node /home/abakken/dev/tsimport/dist/tsimport.js")
(defvar tsimport-backup-suffix nil)
(defun tsimport (&optional symbol)
  (interactive)
  (unless symbol
    (let ((default (thing-at-point 'symbol))
          (alternatives (split-string (shell-command-to-string (format "%s %s --complete" tsimport-command (buffer-file-name))))))
      (when (and default (not (member default alternatives)))
        (setq default nil))
      (setq symbol (completing-read (if default (format "Symbol (default %s): " default) "Symbol: ") alternatives nil t nil nil default))
      (when (string= symbol "")
        (unless default
          (error "No default"))
        (setq symbol default))))
  (shell-command-to-string (format "%s %s %s -i%s"
                                   tsimport-command
                                   (buffer-file-name)
                                   symbol
                                   (if tsimport-backup-suffix
                                       (concat "=" tsimport-backup-suffix)
                                     ""))))
  ;; (message "symbol %s" symbol))

(provide 'tsimport)
