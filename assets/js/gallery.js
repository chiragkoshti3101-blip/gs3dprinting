/* Project galleries — click a project image to see every photo of that project.
   To add a project, add an entry below and put data-gallery="<key>" on its
   .work-media element. */
(function () {
  var galleries = {
    biofuel: {
      title: "Biofuel Production Plant",
      images: [
        {
          src: "assets/img/projects/alltech-crusher.jpg",
          alt: "Biofuel production plant model — overall view",
        },
        {
          src: "assets/img/projects/biofuel/biofuel-billboard.jpg",
          alt: "Biofuel plant model with the “Advance Biofuel — Energy for Future” billboard",
        },
        {
          src: "assets/img/projects/biofuel/biofuel-plant-overview.jpg",
          alt: "Biofuel plant model — tanks and pipe runs seen from above",
        },
        {
          src: "assets/img/projects/biofuel/biofuel-top-view.jpg",
          alt: "Biofuel plant model — top view with admin block, lab and workshop",
        },
        {
          src: "assets/img/projects/biofuel/biofuel-street-view.jpg",
          alt: "Biofuel plant model — lit street view at night",
        },
        {
          src: "assets/img/projects/biofuel/biofuel-storage-tanks.jpg",
          alt: "Biofuel plant model — storage tanks and road",
        },
        {
          src: "assets/img/projects/biofuel/biofuel-billboard-night.jpg",
          alt: "Biofuel plant model — billboard and refinery tower at night",
        },
        {
          src: "assets/img/projects/biofuel/biofuel-display-case.jpg",
          alt: "Biofuel plant model in its glass display case — storage tanks, road and GS3D label",
        },
      ],
    },
    "aluminium-recycling": {
      title: "Aluminium Recycling Plant",
      images: [
        {
          src: "assets/img/projects/aluminium/aluminium-building-detail.jpg",
          alt: "Aluminium recycling plant model — fume stack, building block and ducting detail",
        },
        {
          src: "assets/img/projects/aluminium/aluminium-drum-detail.jpg",
          alt: "Aluminium recycling plant model — rotating drum and conveyor close-up",
        },
        {
          src: "assets/img/projects/aluminium/aluminium-conveyor-view.jpg",
          alt: "Aluminium recycling plant model — ingot casting conveyors on the exhibition display",
        },
      ],
    },
    "boiler-detail": {
      title: "Boiler Detail Section Model",
      images: [
        {
          src: "assets/img/projects/boiler-detail/boiler-detail-front.jpg",
          alt: "Boiler detailed section model — Jet-Robust rotating drum and processing units",
        },
        {
          src: "assets/img/projects/boiler-detail/boiler-detail-side.jpg",
          alt: "Boiler detailed section model — side view of the drum and duct assembly",
        },
        {
          src: "assets/img/projects/boiler-detail/boiler-detail-cone.jpg",
          alt: "Boiler detailed section model — conical duct and white grid tray close-up",
        },
        {
          src: "assets/img/projects/boiler-detail/boiler-detail-drum.jpg",
          alt: "Boiler detailed section model — drum and block processing section detail",
        },
        {
          src: "assets/img/projects/boiler-detail/boiler-detail-exhibition.jpg",
          alt: "Boiler detailed section model on display at the exhibition floor",
        },
      ],
    },
    "mobile-batchmix": {
      title: "Mobile Batch Mix Plant",
      images: [
        {
          src: "assets/img/projects/mobile-batchmix/mmb-front-view.jpg",
          alt: "Mobile batch mix plant model — truck-mounted ULROAD 2250 unit, front view",
        },
        {
          src: "assets/img/projects/mobile-batchmix/mmb-rear-side.jpg",
          alt: "Mobile batch mix plant model — rear-side view with the ALLTECH display base",
        },
        {
          src: "assets/img/projects/mobile-batchmix/mmb-top-view.jpg",
          alt: "Mobile batch mix plant model — top-down view of the trailer and machine layout",
        },
        {
          src: "assets/img/projects/mobile-batchmix/mmb-machine-closeup.jpg",
          alt: "Mobile batch mix plant model — close-up of the black and yellow machine frame",
        },
        {
          src: "assets/img/projects/mobile-batchmix/mmb-model-profile.jpg",
          alt: "Mobile batch mix plant model — full profile of the truck and machine on its base",
        },
      ],
    },
    "batchmix-plant": {
      title: "Batchmix Plant",
      images: [
        {
          src: "assets/img/projects/batchmix/batchmix-upper-structure.jpg",
          alt: "Batchmix plant model — upper structure with catwalks, stairs and operators",
        },
        {
          src: "assets/img/projects/batchmix/batchmix-plant-wide.jpg",
          alt: "Batchmix plant model — wide view of the conveyor, loader and material piles",
        },
        {
          src: "assets/img/projects/batchmix/batchmix-full-display.jpg",
          alt: "Batchmix plant model — full display case with tower, conveyors and trucks",
        },
        {
          src: "assets/img/projects/batchmix/batchmix-top-view.jpg",
          alt: "Batchmix plant model — high-angle view of conveyor, tower and loading area",
        },
        {
          src: "assets/img/projects/batchmix/batchmix-plant-overview.jpg",
          alt: "Batchmix plant model — central processing tower, ladders and platforms",
        },
        {
          src: "assets/img/projects/batchmix/batchmix-loading-road.jpg",
          alt: "Batchmix plant model — paved road, loading station and truck at the perimeter",
        },
        {
          src: "assets/img/projects/batchmix/batchmix-alltech-block.jpg",
          alt: "Batchmix plant model — ALLTECH admin block and control area with operators",
        },
        {
          src: "assets/img/projects/batchmix/batchmix-valve-detail.jpg",
          alt: "Batchmix plant model — valve and piping detail on the processing unit",
        },
      ],
    },
    "pmb-plant": {
      title: "PMB Plant",
      images: [
        {
          src: "assets/img/projects/pmb/pmb-overview.jpg",
          alt: "PMB plant model — control room, storage tank and pipe runs under the display case",
        },
        {
          src: "assets/img/projects/pmb/pmb-tank-detail.jpg",
          alt: "PMB plant model — storage tank and high-shear mill close-up with LED-lit canopy",
        },
      ],
    },
    "bag-filter": {
      title: "Bag Filter Plant",
      images: [
        {
          src: "assets/img/projects/bag-filter/bag-filter-front-view.jpg",
          alt: "Bag filter plant model — front view with bag filter, ID fan and chimney",
        },
        {
          src: "assets/img/projects/bag-filter/bag-filter-furnace-and-dog-houses.jpg",
          alt: "Bag filter plant model — furnace and dog house fume extraction area",
        },
        {
          src: "assets/img/projects/bag-filter/bag-filter-wide-overview.jpg",
          alt: "Bag filter plant model — wide overview with banners at an exhibition",
        },
        {
          src: "assets/img/projects/bag-filter/bag-filter-id-fan-and-chimney.jpg",
          alt: "Bag filter plant model — bag filter, ID fan and chimney on the model",
        },
        {
          src: "assets/img/projects/bag-filter/bag-filter-ducting-spark-trap.jpg",
          alt: "Bag filter plant model — ducting, spark trap, bag filter and chimney",
        },
      ],
    },
  };

  var box = document.getElementById("project-box");
  if (!box) return;

  var img = box.querySelector(".pbox-stage img");
  var titleEl = box.querySelector(".pbox-title");
  var countEl = box.querySelector(".pbox-count");
  var current = [];
  var index = 0;
  var lastTrigger = null;

  // Auto-show the most recent image first, instead of always image 1.
  // For the biofuel gallery the last entry is the latest photo to feature.

  function render() {
    var item = current[index];
    img.src = item.src;
    img.alt = item.alt;
    countEl.textContent = index + 1 + " / " + current.length;
    var preload = new Image();
    preload.src = current[(index + 1) % current.length].src;
  }

  function open(key) {
    var gallery = galleries[key];
    if (!gallery || !gallery.images.length) return;
    current = gallery.images;
    // Show the most recent image first (last in the list).
    index = current.length - 1;
    titleEl.textContent = gallery.title.toUpperCase();
    lastTrigger = document.activeElement;
    box.hidden = false;
    document.body.style.overflow = "hidden";
    render();
    box.querySelector(".pbox-close").focus();
  }

  function close() {
    box.hidden = true;
    document.body.style.overflow = "";
    if (lastTrigger && typeof lastTrigger.focus === "function") {
      lastTrigger.focus();
      lastTrigger = null;
    }
  }

  function step(delta) {
    index = (index + delta + current.length) % current.length;
    render();
  }

  document.querySelectorAll("[data-gallery]").forEach(function (el) {
    el.addEventListener("click", function () {
      open(el.getAttribute("data-gallery"));
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open(el.getAttribute("data-gallery"));
      }
    });
  });

  box.querySelector(".pbox-close").addEventListener("click", close);
  box
    .querySelector(".pbox-prev")
    .addEventListener("click", function () { step(-1); });
  box
    .querySelector(".pbox-next")
    .addEventListener("click", function () { step(1); });

  box.addEventListener("click", function (e) {
    if (e.target === box) close();
  });

  document.addEventListener("keydown", function (e) {
    if (box.hidden) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  /* swipe support on touch devices */
  var startX = null;
  box.addEventListener(
    "touchstart",
    function (e) { startX = e.changedTouches[0].clientX; },
    { passive: true }
  );
  box.addEventListener(
    "touchend",
    function (e) {
      if (startX === null) return;
      var dx = e.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
      startX = null;
    },
    { passive: true }
  );
})();
