/**
 * RebarOptima CAD - Undo / Redo History Manager
 * Command & Snapshot based history architecture for geometric operations.
 */

export class HistoryManager {
  constructor(maxHistory = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
  }

  /**
   * Push state snapshot to undo stack. Clears redo stack.
   * @param {Array|Object} state - Array of geometry objects or compound state object
   */
  pushSnapshot(state) {
    // Deep clone state to prevent reference mutation
    const snapshot = JSON.parse(JSON.stringify(state));
    this.undoStack.push(snapshot);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  /**
   * Undo to previous state
   * @param {Array|Object} currentState - Current state
   * @returns {Array|Object|null} Previous state or null if cannot undo
   */
  undo(currentState) {
    if (this.undoStack.length === 0) return null;
    
    // Save current to redo stack
    this.redoStack.push(JSON.parse(JSON.stringify(currentState)));
    
    // Pop last state
    const previous = this.undoStack.pop();
    return previous;
  }

  /**
   * Redo to next state
   * @param {Array|Object} currentState - Current state
   * @returns {Array|Object|null} Next state or null if cannot redo
   */
  redo(currentState) {
    if (this.redoStack.length === 0) return null;
    
    // Save current to undo stack
    this.undoStack.push(JSON.parse(JSON.stringify(currentState)));
    
    // Pop next state
    const next = this.redoStack.pop();
    return next;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
