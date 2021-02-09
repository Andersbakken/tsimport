(require 'thingatpt)

(defvar tsimport-command "tsimport")
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
  (let ((buffer (current-buffer))
        (replacement))
    (with-temp-buffer
      (if (= (call-process tsimport-command nil t nil (buffer-file-name buffer) symbol) 0)
          (setq replacement (buffer-substring-no-properties (point-min) (point-max)))
        (error "Something happened:\n%s" (buffer-substring-no-properties (point-min) (point-max)))))
    (bookmark-set "tsimport")
    (erase-buffer)
    (insert replacement)
    (bookmark-jump "tsimport")))
  ;; (message "symbol %s" symbol))

(provide 'tsimport)
