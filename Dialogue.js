export default class Dialogue {
    constructor() {
        this.overlay = document.getElementById('dialogue-overlay');
        this.textElement = document.getElementById('dialogue-text');
        this.optionsElement = document.getElementById('dialogue-options');
        this.isActive = false;
    }

    show(text, options) {
        this.textElement.textContent = text;
        this.optionsElement.innerHTML = '';
        options.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option.text;
            button.onclick = option.callback;
            this.optionsElement.appendChild(button);
        });
        this.overlay.style.display = 'flex';
        this.isActive = true;
    }

    hide() {
        this.overlay.style.display = 'none';
        this.isActive = false;
    }
}
