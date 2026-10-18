/**
 * HackerRank Campus Crew — Amrapali University, Haldwani
 * Interactive Visual Security CAPTCHA Engine (captcha.js)
 * 
 * Provides an anti-bot human verification check that renders
 * high-contrast, distortion-proof visual security codes on HTML5 Canvas.
 */

(function () {
  'use strict';

  class CampusCaptcha {
    constructor(canvasId, inputId, refreshBtnId, errorMsgId, options = {}) {
      this.canvas = document.getElementById(canvasId);
      this.input = document.getElementById(inputId);
      this.refreshBtn = document.getElementById(refreshBtnId);
      this.errorMsg = document.getElementById(errorMsgId);
      this.options = Object.assign({
        length: 6,
        caseSensitive: false,
        onVerified: null,
        onFailed: null
      }, options);

      this.currentCode = '';
      this.isVerified = false;

      if (this.canvas) {
        this.init();
      }
    }

    init() {
      this.generate();

      if (this.canvas) {
        this.canvas.addEventListener('click', (e) => {
          e.preventDefault();
          this.refresh();
        });
      }

      if (this.refreshBtn) {
        this.refreshBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.refresh();
        });
      }

      if (this.input) {
        this.input.addEventListener('input', () => {
          this.clearError();
        });
        this.input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            this.validate();
          }
        });
      }
    }

    generateCode() {
      // Clear, non-confusing alphanumeric characters (avoids 0, O, 1, I, l)
      const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
      let code = '';
      for (let i = 0; i < this.options.length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }

    render(code) {
      if (!this.canvas) return;
      const ctx = this.canvas.getContext('2d');
      const width = this.canvas.width;
      const height = this.canvas.height;

      // Dark cybersecurity gradient background
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0a0f18');
      grad.addColorStop(0.5, '#0d1522');
      grad.addColorStop(1, '#08101a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Noise: Random subtle background lines
      for (let i = 0; i < 5; i++) {
        ctx.strokeStyle = `rgba(0, 234, 100, ${Math.random() * 0.2 + 0.1})`;
        ctx.lineWidth = Math.random() * 1.2 + 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.random() * width, Math.random() * height);
        ctx.bezierCurveTo(
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height,
          Math.random() * width, Math.random() * height
        );
        ctx.stroke();
      }

      // Noise: Random subtle dots
      for (let i = 0; i < 25; i++) {
        ctx.fillStyle = `rgba(56, 189, 248, ${Math.random() * 0.35 + 0.1})`;
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render each character with high visibility
      const colors = ['#00ea64', '#38bdf8', '#34d399', '#f3f4f6', '#38bdf8', '#22c55e'];
      const charWidth = width / (code.length + 0.8);

      for (let i = 0; i < code.length; i++) {
        const char = code[i];
        ctx.save();

        const x = (i + 0.6) * charWidth;
        const y = height / 2 + (Math.random() * 4 - 2);

        // Gentle rotation (-10 to +10 deg) to maintain 100% legibility
        const angle = (Math.random() * 20 - 10) * (Math.PI / 180);
        ctx.translate(x, y);
        ctx.rotate(angle);

        ctx.font = `bold ${Math.floor(height * 0.58)}px 'Consolas', 'Courier New', monospace`;
        ctx.fillStyle = colors[i % colors.length];
        ctx.shadowColor = 'rgba(0, 234, 100, 0.4)';
        ctx.shadowBlur = 4;
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'center';

        ctx.fillText(char, 0, 0);
        ctx.restore();
      }

      // Gentle horizontal baseline wave
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 234, 100, 0.35)';
      ctx.lineWidth = 1;
      ctx.moveTo(0, height / 2);
      for (let x = 0; x < width; x += 10) {
        ctx.lineTo(x, height / 2 + Math.sin(x * 0.08) * 4);
      }
      ctx.stroke();
    }

    generate() {
      this.currentCode = this.generateCode();
      this.isVerified = false;
      this.render(this.currentCode);
      if (this.input) this.input.value = '';
      this.clearError();
    }

    refresh() {
      if (this.refreshBtn) {
        const icon = this.refreshBtn.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        setTimeout(() => {
          if (icon) icon.classList.remove('fa-spin');
        }, 400);
      }
      this.generate();
    }

    speak() {
      if ('speechSynthesis' in window) {
        const text = this.currentCode.split('').join(' ');
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.8;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
      }
    }

    validate() {
      const userVal = this.input ? this.input.value.trim() : '';
      if (!userVal) {
        this.showError('Please enter the security CAPTCHA characters.');
        return false;
      }

      // Case-insensitive comparison (characters are uppercase in generateCode)
      const match = userVal.toUpperCase() === this.currentCode.toUpperCase();

      if (match) {
        this.isVerified = true;
        this.clearError();
        if (this.input) {
          this.input.style.borderColor = '#00ea64';
        }
        if (this.options.onVerified) this.options.onVerified(this.currentCode);
        return true;
      } else {
        this.isVerified = false;
        this.showError('Incorrect CAPTCHA code. Please enter the characters shown in the box.');
        this.refresh();
        if (this.options.onFailed) this.options.onFailed();
        return false;
      }
    }

    showError(msg) {
      if (this.errorMsg) {
        this.errorMsg.style.display = 'block';
        this.errorMsg.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${msg}`;
        this.errorMsg.style.color = '#ef4444';
      }
      if (this.input) {
        this.input.style.borderColor = '#ef4444';
        this.input.focus();
      }
    }

    clearError() {
      if (this.errorMsg) {
        this.errorMsg.style.display = 'none';
        this.errorMsg.innerHTML = '';
      }
      if (this.input) {
        this.input.style.borderColor = '';
      }
    }
  }

  window.CampusCaptcha = CampusCaptcha;
})();
