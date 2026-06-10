// Clavier : flèches + WASD (= ZQSD sur AZERTY grâce à e.code)
const BINDINGS = {
  left: ['ArrowLeft', 'KeyA'],
  right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW', 'Space'],
  down: ['ArrowDown', 'KeyS'],
  interact: ['KeyE', 'Enter'],
  teleport: ['KeyT'],
} as const;

type Action = keyof typeof BINDINGS;

const PREVENT = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();

  private onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.down.add(e.code);
  };
  private onKeyUp = (e: KeyboardEvent) => this.down.delete(e.code);
  private onBlur = () => this.down.clear();

  attach() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }

  held(action: Action): boolean {
    return BINDINGS[action].some((c) => this.down.has(c));
  }

  // Vrai une seule fois par appui
  consume(action: Action): boolean {
    const hit = BINDINGS[action].some((c) => this.pressed.delete(c));
    return hit;
  }

  endFrame() {
    this.pressed.clear();
  }
}
