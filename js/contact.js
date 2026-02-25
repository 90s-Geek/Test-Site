(function () {
    'use strict';

    // ── Configuration ──────────────────────────────────────────────────────
    // Replace with your real Formspree form ID after signing up at formspree.io
    var FORMSPREE_ID = 'xgolrjqp';
    var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xgolrjqp' + FORMSPREE_ID;

    // Fallback mailto (used if Formspree hasn't been configured yet)
    var FALLBACK_EMAIL = 'john-mark.holland@mymail.champlain.edu';

    // ── Element refs ───────────────────────────────────────────────────────
    var form        = document.getElementById('contactForm');
    var submitBtn   = document.getElementById('submitBtn');
    var successAlert = document.getElementById('successAlert');

    if (!form) return; // guard: do nothing if form not in DOM

    // ── Bootstrap validation trigger ──────────────────────────────────────
    form.addEventListener('submit', function (event) {
        event.preventDefault();
        event.stopPropagation();

        // Trigger Bootstrap's built-in visual validation
        form.classList.add('was-validated');

        if (!form.checkValidity()) {
            // Focus the first invalid field for accessibility
            var firstInvalid = form.querySelector(':invalid');
            if (firstInvalid) firstInvalid.focus();
            return;
        }

        // ── Collect form data ──────────────────────────────────────────────
        var data = {
            firstName  : getValue('firstName'),
            lastName   : getValue('lastName'),
            email      : getValue('email'),
            subject    : getValue('subject'),
            message    : getValue('message'),
            hearAbout  : getValue('hearAbout')
        };

        // ── Disable submit while sending ───────────────────────────────────
        setSubmitState(true);

        // ── Decide submission path ─────────────────────────────────────────
        if (FORMSPREE_ID === 'YOUR_FORMSPREE_ID') {
            // Formspree not yet configured → fall back to mailto
            submitViaMailto(data);
        } else {
            submitViaFormspree(data);
        }
    });

    // ── Helpers ────────────────────────────────────────────────────────────

    function getValue(id) {
        var el = document.getElementById(id);
        return el ? el.value.trim() : '';
    }

    function setSubmitState(sending) {
        if (sending) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Sending…';
        } else {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Send Message';
        }
    }

    function showSuccess() {
        successAlert.classList.add('show');
        successAlert.scrollIntoView({ behavior: 'smooth', block: 'center' });
        form.reset();
        form.classList.remove('was-validated');
        setSubmitState(false);
    }

    function showError(msg) {
        setSubmitState(false);
        alert('Sorry, there was a problem sending your message.\n\n' + msg +
              '\n\nYou can email me directly at ' + FALLBACK_EMAIL);
    }

    /**
     * Submit data via Formspree AJAX endpoint.
     * @param {Object} data
     */
    function submitViaFormspree(data) {
        var payload = {
            name    : data.firstName + ' ' + data.lastName,
            email   : data.email,
            subject : data.subject,
            message : data.message,
            source  : data.hearAbout || 'Not specified'
        };

        fetch(FORMSPREE_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        })
        .then(function (response) {
            if (response.ok) {
                showSuccess();
            } else {
                return response.json().then(function (json) {
                    throw new Error(json.error || 'Server returned ' + response.status);
                });
            }
        })
        .catch(function (err) {
            showError(err.message);
        });
    }

    /**
     * Fallback: open default mail client via mailto: URI.
     * Used when Formspree is not yet configured.
     * @param {Object} data
     */
    function submitViaMailto(data) {
        var body = 'Name: ' + data.firstName + ' ' + data.lastName + '\n' +
                   'Email: ' + data.email + '\n\n' +
                   data.message;

        var mailto = 'mailto:' + FALLBACK_EMAIL +
                     '?subject=' + encodeURIComponent(data.subject) +
                     '&body='    + encodeURIComponent(body);

        window.location.href = mailto;

        // Show success message after a short delay (mail client opens async)
        setTimeout(showSuccess, 800);
    }

}());
