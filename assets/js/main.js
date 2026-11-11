/* GS3D Printing — site behaviour. No dependencies. */
(function () {
  "use strict";

  var WHATSAPP_NUMBER = "919099719967"; // +91 90997 19967
  var MAX_FILE_MB = 25;

  /* ---------------------------------------------------------------- nav */

  function initNav() {
    var toggle = document.querySelector("[data-nav-open]");
    var drawer = document.querySelector("[data-nav-drawer]");
    if (!toggle || !drawer) return;

    var closeBtn = drawer.querySelector("[data-nav-close]");
    var lastFocus = null;

    // Closed by default: remove it from the accessibility tree and tab order.
    drawer.setAttribute("aria-hidden", "true");
    drawer.inert = true;

    function open() {
      lastFocus = document.activeElement;
      drawer.inert = false;
      drawer.removeAttribute("aria-hidden");
      drawer.classList.add("is-open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      if (closeBtn) closeBtn.focus();
    }

    function close() {
      drawer.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
      // Hide only after focus has left the drawer.
      drawer.setAttribute("aria-hidden", "true");
      drawer.inert = true;
    }

    toggle.addEventListener("click", function () {
      if (drawer.classList.contains("is-open")) close();
      else open();
    });

    if (closeBtn) closeBtn.addEventListener("click", close);

    drawer.addEventListener("click", function (event) {
      if (event.target === drawer) close();
    });

    drawer.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", close);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && drawer.classList.contains("is-open")) close();
    });
  }

  /* ------------------------------------------------------------ reveal

     Base reveal uses CSS to keep the initial render cheap. The scroll-triggered
     GSAP layer below adds the entrance stagger/timelines; when GSAP is absent the
     page still fades in via the .reveal classes. */

  function initReveal() {
    var items = document.querySelectorAll(".reveal");
    if (!items.length) return;

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    items.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ------------------------------------------------------------ GSAP entrance layer

     Loaded once at the bottom of the page from the GSAP CDN. If the build is
     served without network access the site still works — this block is
     no-op when GSAP/scrolltrigger are unavailable. */

  function initEntrances() {
    /* GSAP 3 exposes an object, not a function. */
    var hasGSAP = typeof gsap !== "undefined" && !!gsap;
    if (!hasGSAP) return;

    var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var defaults = reducedMotion
      ? { duration: 0.001, ease: "none" }
      : { duration: 0.85, ease: "power3.out" };

    var heroReady = function () {
      var title = document.querySelector(".hero h1");
      var lede = document.querySelector(".hero-lede");
      var actions = document.querySelector(".hero-actions");
      var assurance = document.querySelector(".hero-assurance");
      var stats = document.querySelector(".hero-stats");
      var statNumbers = stats ? stats.querySelectorAll("dt, dd") : [];

      var tl = gsap.timeline(defaults);

      // Set entrance positions without layout surprise.
      if (title) gsap.set(title, { opacity: 0, y: 26 });
      if (lede) gsap.set(lede, { opacity: 0, y: 18 });
      if (actions) gsap.set(actions, { opacity: 0, y: 16 });
      if (assurance) gsap.set(assurance, { opacity: 0, y: 12 });
      if (stats) {
        gsap.set(stats, { opacity: 0, y: 22 });
        statNumbers.forEach(function (n) { gsap.set(n, { opacity: 0 }); });
      }

      tl.to(title, { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" })
        .to(lede, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, "<0.12")
        .to(actions, { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" }, "<0.14")
        .to(assurance, { opacity: 1, y: 0, duration: 0.75, ease: "power3.out" }, "<0.12")
        .to(stats, { opacity: 1, y: 0, duration: 0.85, ease: "power3.out" }, "<0.18")
        .call(function () {
          statNumbers.forEach(function (n, i) {
            var raw = n.textContent.trim();
            var end = parseInt(raw, 10);
            if (isNaN(end)) {
              gsap.set(n, { opacity: 1 });
              return;
            }
            /* Keep any suffix ("400+" counts to 400, then the plus returns). */
            var suffix = raw.replace(/[0-9\s]+/, "");
            n.textContent = "0" + suffix;
            gsap.set(n, { opacity: 1 });
            var proxy = { v: 0 };
            gsap.to(proxy, {
              v: end,
              duration: reducedMotion ? 0.001 : 1.6,
              ease: "power2.out",
              delay: reducedMotion ? 0 : i * 0.1,
              onUpdate: function () {
                n.textContent = Math.round(proxy.v) + suffix;
              },
              onComplete: function () {
                n.textContent = end + suffix;
              }
            });
          });
        }, null, "<0.1");
    };

    // If the hero contents are already painted, run immediately; otherwise
    // wait a tick so Three.js / fonts have not pushed layout around yet.
    if (document.querySelector(".hero h1")) {
      heroReady();
    } else {
      window.setTimeout(heroReady, 450);
    }

    // Service cards stagger in once the section is near the viewport.
    var servicesSection = document.querySelector(".services");
    if (servicesSection && typeof gsap.fromTo === "function") {
      var serviceCards = servicesSection.querySelectorAll(".service-card.reveal");
      if (serviceCards.length) {
        gsap.fromTo(
          serviceCards,
          { opacity: 0, y: 34 },
          {
            scrollTrigger: {
              trigger: servicesSection,
              start: "top 88%",
              toggleActions: "play none none reverse"
            },
            opacity: 1,
            y: 0,
            duration: reducedMotion ? 0.001 : 0.9,
            stagger: { each: 0.14, from: "start" },
            ease: "power3.out"
          }
        );
      }
    }

    // Industry chips fade in as the industries section enters.
    var industriesSection = document.querySelector(".industries");
    if (industriesSection && typeof gsap.fromTo === "function") {
      var industryItems = industriesSection.querySelectorAll(".industry-item");
      if (industryItems.length) {
        gsap.fromTo(
          industryItems,
          { opacity: 0, y: 18 },
          {
            scrollTrigger: {
              trigger: industriesSection,
              start: "top 90%",
              toggleActions: "play none none reverse"
            },
            opacity: 1,
            y: 0,
            duration: reducedMotion ? 0.001 : 0.7,
            stagger: { each: 0.05, from: "start" },
            ease: "power2.out"
          }
        );
      }
    }

    // Quote form fields settle in when their section is near.
    var quoteSection = document.querySelector("#quote");
    if (quoteSection && typeof gsap.fromTo === "function") {
      var quoteBlocks = quoteSection.querySelectorAll(".quote__step, .quote__form");
      if (quoteBlocks.length) {
        gsap.fromTo(
          quoteBlocks,
          { opacity: 0, y: 22 },
          {
            scrollTrigger: {
              trigger: quoteSection,
              start: "top 92%",
              toggleActions: "play none none reverse"
            },
            opacity: 1,
            y: 0,
            duration: reducedMotion ? 0.001 : 0.8,
            stagger: { each: 0.12, from: "edges" },
            ease: "power3.out"
          }
        );
      }
    }

    /* Headings arrive with a frost rise: a short lift plus blur clearing
       as they enter. Transform/opacity/filter only — never clipped, so
       hit-testing, selection and accessibility are untouched. */
    if (!reducedMotion) {
      var riseHeads = document.querySelectorAll(".section-head .h2, .clients-heading");
      riseHeads.forEach(function (h) {
        gsap.from(h, {
          scrollTrigger: {
            trigger: h,
            start: "top 90%",
            toggleActions: "play none none none"
          },
          y: 28,
          opacity: 0,
          filter: "blur(6px)",
          duration: 1,
          ease: "power3.out",
          onComplete: function () {
            gsap.set(h, { clearProps: "filter,opacity,transform" });
          }
        });
      });

      /* Process rail: a line draws across the steps, scrubbed to the scroll. */
      var processList = document.querySelector(".process");
      if (processList && typeof ScrollTrigger !== "undefined") {
        var rail = document.createElement("li");
        rail.className = "process-rail";
        rail.setAttribute("aria-hidden", "true");
        var railFill = document.createElement("span");
        railFill.className = "process-rail__fill";
        rail.appendChild(railFill);
        processList.insertBefore(rail, processList.firstChild);
        gsap.fromTo(
          railFill,
          { scaleX: 0 },
          {
            scaleX: 1,
            ease: "none",
            scrollTrigger: {
              trigger: processList,
              start: "top 82%",
              end: "bottom 48%",
              scrub: 0.4
            }
          }
        );
      }
    }
  }

  /* Exposed for the entrance kicker at the end of <body>. */
  window.initEntrances = initEntrances;

  /* ------------------------------------------------------------- files */

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function initDropzones() {
    document.querySelectorAll("[data-dropzone]").forEach(function (zone) {
      var input = zone.querySelector("input[type=file]");
      var list = zone.parentElement.querySelector("[data-file-list]");
      var error = zone.parentElement.querySelector("[data-file-error]");
      if (!input || !list) return;

      var store = [];
      var objectUrls = [];

      /* Detects blank / empty images (flat or near-empty pixels) so a user
         never hands GS3D an accidental white render. Samples a 64x64 downscale
         and flags it when luminance std-dev < 6 (out of 255) or the frame is
         uniformly near-white / near-black. Safe: object URLs never taint the
         canvas. */
      function checkBlank(file, onResult) {
        var url = file._previewUrl;
        if (!url) { onResult(false); return; }
        var img = new Image();
        img.onload = function () {
          var W = 64, H = 64;
          var c = document.createElement("canvas");
          c.width = W;
          c.height = H;
          var ctx;
          try {
            ctx = c.getContext("2d", { willReadFrequently: true });
          } catch (e) { onResult(false); return; }
          var data;
          try {
            ctx.drawImage(img, 0, 0, W, H);
            data = ctx.getImageData(0, 0, W, H).data;
          } catch (e) { onResult(false); return; }
          var n = W * H, sum = 0, sumSq = 0, i, l;
          for (i = 0; i < data.length; i += 4) {
            l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sum += l;
            sumSq += l * l;
          }
          var mean = sum / n;
          var std = Math.sqrt(Math.max(sumSq / n - mean * mean, 0));
          var nearWhite = mean > 245;
          var nearBlack = mean < 10;
          var isBlank = std < 6 || (nearWhite && std < 18) || (nearBlack && std < 18);
          onResult(isBlank);
        };
        img.onerror = function () { onResult(false); };
        img.src = url;
      }

      function track(file) {
        if (file.type && file.type.indexOf("image/") === 0) {
          var url = URL.createObjectURL(file);
          objectUrls.push(url);
          file._previewUrl = url;
          checkBlank(file, function (isBlank) {
            file._blank = isBlank;
            if (isBlank && error) {
              error.textContent =
                "\u26A0 \u201C" + file.name + "\u201D looks blank or empty \u2014 please check it before sending.";
            }
            render();
          });
        }
      }

      function release(file) {
        if (file._previewUrl) {
          try { URL.revokeObjectURL(file._previewUrl); } catch (e) {}
          file._previewUrl = "";
        }
      }

      function render() {
        list.innerHTML = "";
        store.forEach(function (file, index) {
          var li = document.createElement("li");
          if (file._previewUrl) {
            var thumb = document.createElement("img");
            thumb.className = "fthumb";
            thumb.src = file._previewUrl;
            thumb.alt = "Preview of " + file.name;
            li.appendChild(thumb);
          }
          var name = document.createElement("span");
          name.className = "fname";
          name.textContent = file.name;
          if (file._blank) {
            var badge = document.createElement("span");
            badge.className = "fblank";
            badge.textContent = "looks blank";
            badge.title = "This image appears empty or fully white — check it before sending.";
            li.appendChild(badge);
          }

          var size = document.createElement("span");
          size.className = "fsize";
          size.textContent = formatSize(file.size);

          var remove = document.createElement("button");
          remove.type = "button";
          remove.textContent = "\u00D7";
          remove.setAttribute("aria-label", "Remove " + file.name);
          remove.style.cssText =
            "border:0;background:none;font-size:1rem;line-height:1;color:#5f6a76;padding:0 2px;";

          remove.addEventListener("click", function () {
            var removed = store[index];
            store.splice(index, 1);
            release(removed);
            render();
          });

          li.appendChild(name);
          li.appendChild(size);
          li.appendChild(remove);
          list.appendChild(li);
        });
      }

      function accept(files) {
        if (error) error.textContent = "";
        var rejected = 0;
        Array.prototype.forEach.call(files, function (file) {
          // dedupe: same name + size already attached
          var isDup = store.some(function (f) { return f.name === file.name && f.size === file.size; });
          if (isDup) { rejected++; return; }
          if (file.size > MAX_FILE_MB * 1024 * 1024) {
            if (error) {
              error.textContent =
                file.name + " is larger than " + MAX_FILE_MB + " MB — email us instead.";
            }
            return;
          }
          track(file);
          store.push(file);
        });
        if (rejected && error) {
          error.textContent = rejected + " file(s) were already attached.";
        }
        render();
      }

      input.addEventListener("change", function () {
        accept(input.files);
        input.value = "";
      });

      ["dragenter", "dragover"].forEach(function (type) {
        zone.addEventListener(type, function (event) {
          event.preventDefault();
          zone.classList.add("is-drag");
        });
      });

      ["dragleave", "drop"].forEach(function (type) {
        zone.addEventListener(type, function (event) {
          event.preventDefault();
          zone.classList.remove("is-drag");
        });
      });

      zone.addEventListener("drop", function (event) {
        if (event.dataTransfer && event.dataTransfer.files) {
          accept(event.dataTransfer.files);
        }
      });

      zone._files = store;
    });
  }

  /* -------------------------------------------------------------- forms */

  function setError(field, message) {
    var error = field.querySelector(".error");
    var input = field.querySelector("input, select, textarea");
    if (error) error.textContent = message || "";
    if (input) {
      if (message) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    }
  }

  function validate(form) {
    var firstInvalid = null;

    form.querySelectorAll("[data-field]").forEach(function (field) {
      var input = field.querySelector("input, select, textarea");
      if (!input) return;

      var value = (input.value || "").trim();
      var required = input.hasAttribute("required");
      var type = input.getAttribute("type");

      setError(field, "");

      if (required && !value) {
        setError(field, "This field is required.");
        firstInvalid = firstInvalid || input;
        return;
      }

      if (type === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
        setError(field, "Enter a valid email address.");
        firstInvalid = firstInvalid || input;
        return;
      }

      if (type === "tel" && value) {
        var digits = value.replace(/\D/g, "");
        if (digits.length < 10) {
          setError(field, "Enter a valid phone number (10 digits).");
          firstInvalid = firstInvalid || input;
        }
      }
    });

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  }

  function collect(form) {
    var data = {};
    form.querySelectorAll("input, select, textarea").forEach(function (input) {
      if (!input.name || input.type === "file" || input.type === "submit") return;
      if (input.name === "company_website") return; // honeypot
      data[input.name] = (input.value || "").trim();
    });

    var files = [];
    var fileObjects = [];
    var list = form.querySelector("[data-file-list]");
    if (list) {
      list.querySelectorAll(".fname").forEach(function (item) {
        files.push(item.textContent);
      });
    }
    // Real File objects live on the dropzone (the list only stores names).
    var zone = form.querySelector("[data-dropzone]");
    if (zone && zone._files && zone._files.length) {
      fileObjects = zone._files.slice();
    }
    data.files = files;
    data.fileObjects = fileObjects;
    return data;
  }

  /* Format an Indian phone to a clean, readable E.164-ish form for display. */
  function fmtPhone(raw) {
    var d = String(raw || "").replace(/\D/g, "");
    if (!d) return String(raw || "");
    if (d.length === 10 && /^[6-9]/.test(d)) d = "91" + d;           // bare 10-digit
    if (d.length === 11 && d.charAt(0) === "0") d = "91" + d.slice(1); // 0-prefixed
    var cc = d.length > 10 ? d.slice(0, d.length - 10) : "91";
    var rest = d.length > 10 ? d.slice(d.length - 10) : d;
    return "+" + cc + " " + rest.slice(0,3) + " " + rest.slice(3,6) + " " + rest.slice(6);
  }

  /* Compact message. WhatsApp truncates long ?text= deep links, so the body
     stays short: header line + one details line + a capped file-link line.
     Blanks are flagged inline; nothing is silently dropped. */
  function buildMessage(data) {
    var lines = ["GS3D quote request"];
    var head = [];
    if (data.name) head.push(data.name);
    if (data.phone) head.push(fmtPhone(data.phone));
    if (data.service) head.push(data.service);
    lines.push(head.join(" \u00b7 ") || "New enquiry");
    var details = [];
    if (data.company) details.push("Company " + data.company);
    if (data.email) details.push("Email " + data.email);
    if (data.deadline) details.push("Needed by " + data.deadline);
    if (data.message) details.push(data.message);
    if (details.length) lines.push(details.join(" \u00b7 "));
    var links = (data.fileLinks || []).filter(function (l) { return l.url; });
    if (links.length) {
      // Keep the whole prefill under ~440 chars so it reliably renders in the draft.
      var entries = links.map(function (l) {
        var label = l.name + (l.blank ? " (may be blank)" : "");
        return label + " \u2192 " + l.url;
      });
      var running = lines.join("\n").length + 1 + "Files: ".length;
      var n = 0, joined = "";
      while (n < entries.length) {
        var candidate = n === 0 ? entries[0] : joined + "  " + entries[n];
        if (running + candidate.length > 440 && n > 0) break;
        joined = candidate; n++;
      }
      var body = joined;
      if (n < links.length) body += "  +" + (links.length - n) + " more";
      lines.push("Files (" + links.length + "): " + body);
    } else if (data.files && data.files.length) {
      lines.push("Files to attach: " + data.files.join(", "));
    }
    if (data.fileNotes && data.fileNotes.length) lines.push(data.fileNotes.join(" \u00b7 "));
    return lines.join("\n");
  }

  /* Uploads attached quote files straight to Vercel Blob (Hobby-safe:
     the function only presigns; bytes travel browser → storage directly).
     Returns [{ name, url }] for the ones that landed, plus any failures. */
  async function uploadFiles(fileObjects) {
    var payload = { files: fileObjects.map(function (f) {
      return { name: f.name, type: f.type, size: f.size };
    }) };
    var resp;
    try {
      resp = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      return { urls: {}, errors: ["upload service unreachable"] };
    }
    var data;
    try { data = await resp.json(); } catch (e) { return { urls: {}, errors: ["bad upload response"] }; }
    var urls = {};
    var errors = [];
    (data.files || []).forEach(function (item) {
      if (item.ok && item.putUrl) {
        urls[item.name] = { putUrl: item.putUrl, putHeaders: item.putHeaders || {}, publicUrl: item.publicUrl };
      } else {
        errors.push(item.name + (item.error ? " (" + item.error + ")" : ""));
      }
    });
    return { urls: urls, errors: errors };
  }

  async function putFiles(fileObjects, urls) {
    var done = {};
    for (var i = 0; i < fileObjects.length; i++) {
      var file = fileObjects[i];
      var spec = urls[file.name];
      if (!spec) continue;
      try {
        // Send the raw bytes (a File/Blob) straight to the presigned URL.
        var resp = await fetch(spec.putUrl, {
          method: "PUT",
          headers: Object.assign({ "Content-Type": file.type || "application/octet-stream" }, spec.putHeaders || {}),
          body: file,
        });
        done[file.name] = (resp.status === 200 || resp.status === 201) ? spec.publicUrl : null;
      } catch (e) {
        done[file.name] = null;
      }
    }
    return done;
  }

  function initForms() {
    document.querySelectorAll("[data-quote-form]").forEach(function (form) {
      var status = form.querySelector("[data-status]");
      var submit = form.querySelector("button[type=submit]");

      form.addEventListener("submit", async function (event) {
        event.preventDefault();

        // Honeypot: bots fill hidden fields, humans never see them.
        var trap = form.querySelector('input[name="company_website"]');
        if (trap && trap.value) return;

        if (!validate(form)) {
          if (status) {
            status.className = "form-status is-error";
            status.textContent = "Please check the highlighted fields.";
          }
          return;
        }

        var data = collect(form);
        var hasFiles = (data.fileObjects || []).length > 0;
        if (!hasFiles) {
          try {
            fetch("api/inbox.js", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                op: "record", ts: Date.now(),
                form: { name: data.name, phone: data.phone, company: data.company,
                        email: data.email, service: data.service,
                        deadline: data.deadline, message: data.message },
                files: []
              })
            }).then(function (r) { return r.json(); }).catch(function () {});
          } catch (e) {}
        }

        // Blank-image heads-up (never blocks; adds a note to the handoff).
        var blankFiles = (data.fileObjects || []).filter(function (f) { return f._blank; });
        if (blankFiles.length && status) {
          status.className = "form-status is-warn";
          status.textContent =
            "Heads-up: “" + blankFiles.map(function (f) { return f.name; }).join("”, “") +
            "” looks blank or empty — a note has been added so we can follow up.";
        }

        // Upload attached files → download links land in the WhatsApp message.
        var fileLinks = [];
        var uploadErrors = [];
        if ((data.fileObjects || []).length) {
          if (status) {
            status.className = "form-status is-info";
            status.textContent = "Uploading your files…";
          }
          try {
            var presigned = await uploadFiles(data.fileObjects);
            var done = await putFiles(data.fileObjects, presigned.urls);
            presigned.errors.forEach(function (e) { uploadErrors.push(e); });
            (data.fileObjects || []).forEach(function (f) {
              if (done[f.name]) {
                fileLinks.push({ name: f.name, url: done[f.name] });
              } else {
                uploadErrors.push(f.name);
              }
            });
            // Record the enquiry in the GS3D admin inbox (silent, best-effort).
            try {
              var rec = {
                op: "record",
                ts: Date.now(),
                form: {
                  name: data.name, phone: data.phone, company: data.company,
                  email: data.email, service: data.service, deadline: data.deadline, message: data.message
                },
                files: fileLinks.map(function (l) { return { name: l.name, url: l.url }; })
              };
              fetch("api/inbox.js", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(rec)
              }).then(function (r) { return r.json(); }).catch(function () {});
            } catch (e) { /* never block the WhatsApp handoff */ }
          } catch (e) {
            uploadErrors.push("upload failed");
          }
          data.fileLinks = fileLinks;
        }

        // Flag blanks on the link objects so the compact message can note them.
        blankFiles.forEach(function (f) {
          (data.fileLinks || []).forEach(function (l) { if (l.name === f.name) l.blank = true; });
        });
        if (uploadErrors.length) {
          data.fileNotes = [uploadErrors.length + " file(s) not uploaded - please attach in chat"];
        }

        var message = buildMessage(data);
        var url = "https://wa.me/+" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);

        if (status) {
          status.className = "form-status is-ok";
          status.textContent = fileLinks.length
            ? "WhatsApp has opened with your details — tap the green Send button in the chat to deliver it to us. Your files are linked in the message. We reply within 24 working hours."
            : "WhatsApp has opened with your details — tap the green Send button in the chat to deliver it to us. We reply within 24 working hours.";
        }

        if (submit) {
          submit.disabled = true;
          submit.textContent = "Opening WhatsApp…";
        }

        // Open immediately while the tap/click gesture is still fresh.
        // If the browser blocks it (popup blocker, mobile Safari), hand the
        // user a one-tap button instead of a dead end.
        var win = null;
        try { win = window.open(url, "_blank", "noopener"); } catch (e) { win = null; }
        var cont = document.createElement("a");
        cont.href = url;
        cont.target = "_blank";
        cont.rel = "noopener";
        cont.className = "wa-continue";
        cont.textContent = "Open WhatsApp with your details \u2192";
        if (!win) {
          if (status) {
            status.className = "form-status is-info";
            status.textContent = "Your details and files are ready. If WhatsApp didn't open, tap the button below.";
          }
          (status || submit).insertAdjacentElement("afterend", cont);
          cont.focus();
        }

        // Give the status a beat to be read before the cleanup.
        window.setTimeout(function () {
          if (submit) {
            submit.disabled = false;
            submit.textContent = submit.getAttribute("data-label") || "Send request";
          }
          form.reset();
          var list = form.querySelector("[data-file-list]");
          if (list) list.innerHTML = "";
        }, 1500);
      });
    });
  }

  /* ------------------------------------------------------------- misc */

  function initHeaderState() {
    var header = document.querySelector(".site-header");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function initYear() {
    document.querySelectorAll("[data-year]").forEach(function (node) {
      node.textContent = String(new Date().getFullYear());
    });
  }

  /* Subtle depth on the hero photo: the panel tips toward the pointer.
     Pointer-fine only, and never when motion is reduced. */
  function initHeroTilt() {
    var hero = document.querySelector(".hero");
    var frame = document.querySelector(".hero-media-frame");
    if (!hero || !frame) return;
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var raf = 0;
    var next = { x: 0, y: 0 };

    function apply() {
      raf = 0;
      frame.style.setProperty("--tilt-y", next.x.toFixed(2) + "deg");
      frame.style.setProperty("--tilt-x", next.y.toFixed(2) + "deg");
    }

    hero.addEventListener(
      "pointermove",
      function (event) {
        var rect = hero.getBoundingClientRect();
        var x = (event.clientX - rect.left) / rect.width - 0.5;
        var y = (event.clientY - rect.top) / rect.height - 0.5;
        next.x = Math.max(-3.5, Math.min(3.5, x * 7));
        next.y = Math.max(-2.5, Math.min(2.5, -y * 5));
        if (!raf) raf = window.requestAnimationFrame(apply);
      },
      { passive: true }
    );

    hero.addEventListener("pointerleave", function () {
      next.x = 0;
      next.y = 0;
      if (!raf) raf = window.requestAnimationFrame(apply);
    });
  }

  /* The sticky mobile bar follows a reading pattern: it stays out of the way
     while you scroll down through content, and rises when you scroll back up
     (when you are looking for the call/quote actions). Without JS — or with
     reduced motion — it is simply always there. */
  function initMobileBar() {
    var bar = document.querySelector(".mobile-bar");
    var hero = document.querySelector(".hero");
    if (!bar || !hero) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    document.documentElement.classList.add("js-anim");
    var lastY = window.scrollY;
    var shown = false;
    var update = function () {
      var y = window.scrollY;
      var delta = y - lastY;
      lastY = y;
      if (Math.abs(delta) < 6) return;
      var next = y > hero.offsetHeight * 0.6 && delta < 0;
      if (next !== shown) {
        shown = next;
        bar.classList.toggle("is-shown", shown);
      }
    };
    window.addEventListener("scroll", update, { passive: true });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initReveal();
    initDropzones();
    initForms();
    initHeaderState();
    initYear();
    initHeroTilt();
    initMobileBar();
  });
})();
