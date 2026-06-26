// OthelloGame.ts - Pure logic, no Cocos imports
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;

export type CellState = typeof EMPTY | typeof BLACK | typeof WHITE;
export type Player = typeof BLACK | typeof WHITE;
export type Position = { row: number; col: number };

export class OthelloGame {
    private board: CellState[][];
    private currentPlayer: Player;
    private boardSize: number = 8;

    // Direction vectors for scanning
    private static readonly DIRECTIONS = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1]
    ];

    constructor() {
        this.board = [];
        for (let r = 0; r < this.boardSize; r++) {
            this.board[r] = [];
            for (let c = 0; c < this.boardSize; c++) {
                this.board[r][c] = EMPTY;
            }
        }
        // Standard initial configuration
        const mid = this.boardSize / 2;
        this.board[mid - 1][mid - 1] = WHITE;
        this.board[mid - 1][mid]     = BLACK;
        this.board[mid][mid - 1]     = BLACK;
        this.board[mid][mid]         = WHITE;

        this.currentPlayer = BLACK;
    }

    // Public getters
    getBoard(): CellState[][] { return this.board; }
    getCurrentPlayer(): Player { return this.currentPlayer; }

    // Check if a move is valid for a given player
    isValidMove(row: number, col: number, player: Player): boolean {
        if (this.board[row][col] !== EMPTY) return false;
        return this.getFlips(row, col, player).length > 0;
    }

    // Returns all opponent pieces that would be flipped by this move
    getFlips(row: number, col: number, player: Player): Position[] {
        const opponent = player === BLACK ? WHITE : BLACK;
        const flips: Position[] = [];

        for (const [dr, dc] of OthelloGame.DIRECTIONS) {
            let r = row + dr;
            let c = col + dc;
            const potential: Position[] = [];

            while (r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize &&
                   this.board[r][c] === opponent) {
                potential.push({ row: r, col: c });
                r += dr;
                c += dc;
            }
            if (potential.length > 0 &&
                r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize &&
                this.board[r][c] === player) {
                flips.push(...potential);
            }
        }
        return flips;
    }

    // Execute a move (assumed valid). Returns the flipped positions (for animation).
    makeMove(row: number, col: number): Position[] | null {
        const flips = this.getFlips(row, col, this.currentPlayer);
        if (flips.length === 0) return null; // invalid move

        // Place the disc
        this.board[row][col] = this.currentPlayer;
        // Flip opponent discs
        for (const { row: r, col: c } of flips) {
            this.board[r][c] = this.currentPlayer;
        }

        // Switch players
        this.currentPlayer = this.currentPlayer === BLACK ? WHITE : BLACK;
        return flips;
    }

    // Check if a player has any valid move
    hasValidMove(player: Player): boolean {
        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                if (this.isValidMove(r, c, player)) return true;
            }
        }
        return false;
    }

    // Skip turn if current player has no valid moves (returns true if skipped)
    skipTurnIfNeeded(): boolean {
        if (!this.hasValidMove(this.currentPlayer)) {
            const other = this.currentPlayer === BLACK ? WHITE : BLACK;
            if (this.hasValidMove(other)) {
                this.currentPlayer = other;
                return true;
            }
        }
        return false;
    }

    // Game over detection
    isGameOver(): boolean {
        return !this.hasValidMove(BLACK) && !this.hasValidMove(WHITE);
    }

    // Get winner: returns the player with more discs, or null for tie
    getWinner(): Player | null {
        let blackCount = 0, whiteCount = 0;
        for (const row of this.board) {
            for (const cell of row) {
                if (cell === BLACK) blackCount++;
                else if (cell === WHITE) whiteCount++;
            }
        }
        if (blackCount > whiteCount) return BLACK;
        if (whiteCount > blackCount) return WHITE;
        return null;
    }

    // Get disc counts
    getScore(): { black: number; white: number } {
        let black = 0, white = 0;
        for (const row of this.board) {
            for (const cell of row) {
                if (cell === BLACK) black++;
                else if (cell === WHITE) white++;
            }
        }
        return { black, white };
    }
}