class SigilLoader {
	constructor(options = {}) {
		this.config = {
			selector: options.selector || ".loader",
			percentSelector: options.percentSelector || ".loading-percent",
			imageSelector: options.imageSelector || "img[data-loader]",
			skipOnRepeat: options.skipOnRepeat ?? true,
			delay: options.delay ?? 0.5, 
			milestones: options.milestones || {
				fonts: 20,
				dom: 20,
				images: 40,
				unicorn: 20
			},
			animation: {
				duration: 0.5,
				ease: "power2.out",
				snap: {
					innerText: 1
				},
				...options.animation 
			},
			hooks: {
				onStart: options.hooks?.onStart || null,
				onMilestone: options.hooks?.onMilestone || null,
				onComplete: options.hooks?.onComplete || null
			}
		};


		this.milestones = {};
		this.targetProgress = 0;
		this.displayedProgress = 0;
		this.animationTween = null;

		for (const key in this.config.milestones) {
			this.milestones[key] = {
				done: false,
				weight: this.config.milestones[key]
			};
		}

		this.$loader = document.querySelector(this.config.selector);
		this.$percent = document.querySelector(this.config.percentSelector);
	}

	init() {
		if (this.config.skipOnRepeat && localStorage.getItem("hasVisited")) {
			this._skipLoader();
			return;
		}

		if (!document.documentElement.classList.contains("preload")) {
  		document.documentElement.classList.add("preload");
		}

		localStorage.setItem("hasVisited", "true");

		// Show the loader immediately
		document.documentElement.classList.remove("preload");
		document.body.classList.add("loading");

		// Then delay milestone tracking
		setTimeout(() => {
			if (typeof this.config.hooks.onStart === "function") {
				this.config.hooks.onStart();
			}

			this._setupDOMListener();
			this._setupFontListener();
			this._setupImageLoader();
			this._setupUnicornLoader();
		}, this.config.delay * 1000);
	}

	_skipLoader() {
		if (this.$loader) {
			this.$loader.style.display = "none";
		}
		document.body.classList.remove("loading");
	}

	setMilestone(key) {
		const milestone = this.milestones[key];
		if (!milestone || milestone.done) return;

		milestone.done = true;

		let total = 0;
		for (const key in this.milestones) {
			if (this.milestones[key].done) {
				total += this.milestones[key].weight;
			}
		}

		this.targetProgress = total;
		this._animateProgress();

		if (typeof this.config.hooks.onMilestone === "function") {
			this.config.hooks.onMilestone(key, this.targetProgress);
		}
	}

	_animateProgress() {
		if (this.animationTween) this.animationTween.kill();

		const fromValue = this.displayedProgress;
		const toValue = this.targetProgress;

		const defaultTween = () => {
			this.animationTween = gsap.to({
				value: fromValue
			}, {
				value: toValue,
				duration: this.config.animation.duration,
				ease: this.config.animation.ease,
				snap: this.config.animation.snap,
				onUpdate: () => {
					this.displayedProgress = this.animationTween.targets()[0].value;
					this.$percent.innerText = `${Math.round(this.displayedProgress)}%`;
				},
				onComplete: () => {
					if (Math.round(this.displayedProgress) >= 100) {
						this._destroy();
					}
				}
			});
		};

		if (typeof this.config.animation.animateProgress === "function") {
			this.config.animation.animateProgress({
				from: fromValue,
				to: toValue,
				element: this.$percent,
				onComplete: () => {
					if (Math.round(toValue) >= 100) {
						this._destroy();
					}
				}
			});
		} else {
			defaultTween();
		}

	}

	_destroy() {
		if (typeof this.config.hooks.onComplete === "function") {
			this.config.hooks.onComplete();
		}
	}

	_setupDOMListener() {
		if (document.readyState === "interactive" || document.readyState === "complete") {
			this.setMilestone("dom");
		} else {
			document.addEventListener("DOMContentLoaded", () => {
				this.setMilestone("dom");
			});
		}
	}

	_setupFontListener() {
		if (document.fonts && document.fonts.ready) {
			document.fonts.ready.then(() => {
				this.setMilestone("fonts");
			});
		} else {
			this.setMilestone("fonts");
		}
	}

	_setupImageLoader() {
		const images = document.querySelectorAll(this.config.imageSelector);
		const total = images.length;

		if (total === 0) {
			this.setMilestone("images");
			return;
		}

		let loaded = 0;

		const handleLoad = () => {
			loaded++;
			const fraction = loaded / total;
			const partialWeight = this.milestones.images.weight * fraction;

			const otherProgress = Object.keys(this.milestones).reduce((sum, key) => {
				if (key === "images") return sum;
				return this.milestones[key].done ? sum + this.milestones[key].weight : sum;
			}, 0);

			this.targetProgress = otherProgress + partialWeight;
			this._animateProgress();

			if (loaded === total) {
				this.setMilestone("images");
			}
		};

		images.forEach((img) => {
			if (img.complete) {
				handleLoad();
			} else {
				img.addEventListener("load", handleLoad);
				img.addEventListener("error", handleLoad);
			}
		});
	}

	_setupUnicornLoader() {
		if (!this.milestones.unicorn) return;

		if (typeof UnicornStudio !== "undefined" && typeof UnicornStudio.init === "function") {
			UnicornStudio.init()
				.then(() => this.setMilestone("unicorn"))
				.catch((err) => {
					console.warn("UnicornStudio failed to load:", err);
					this.setMilestone("unicorn");
				});
		} else {
			this.setMilestone("unicorn");
		}
	}
}