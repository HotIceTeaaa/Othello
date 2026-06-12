import { _decorator, Component, Node, instantiate, Prefab, UITransform, EventTouch, Vec2, Vec3, Sprite, Color } from 'cc';
import { OthelloGame, BLACK, WHITE, EMPTY, Player, Position } from './OthelloGame';
const { ccclass, property } = _decorator;

@ccclass('BoardView')
export class BoardView extends Component {
    @property({ type: Prefab })
    piecePrefab: Prefab = null!;    // drag piece prefab here

    @property
    cellSize: number = 90;          // pixels per cell

    private game: OthelloGame = new OthelloGame();
    private boardSize: number = 8;  // match game's size

    onLoad() {
        // Build the visual board initially
        this.redrawAllPieces();
        // Listen for clicks on the board node
        this.node.on(Node.EventType.TOUCH_END, this.onBoardClick, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onBoardClick, this);
    }

    // --- Input handling ---
    private onBoardClick(event: EventTouch) {
        // Game over? ignore clicks
        if (this.game.isGameOver()) return;

        const cell = this.screenToGrid(event);
        if (!cell) return;

        // Attempt to make a move
        const flips = this.game.makeMove(cell.row, cell.col);
        if (flips) {
            // Move was successful – redraw board (or animate flips)
            this.redrawAllPieces();
            // Check if next player needs to skip
            this.game.skipTurnIfNeeded();
            // If game is now over, you can show a message or log
            if (this.game.isGameOver()) {
                const winner = this.game.getWinner();
                if (winner) {
                    console.log(`Game over! ${winner === BLACK ? 'Black' : 'White'} wins!`);
                } else {
                    console.log('Game over! It’s a tie!');
                }
            }
        } else {
            // Invalid move – maybe play a sound or flash the cell
            console.log('Invalid move');
        }
    }

    // Convert screen touch coordinates to grid cell (row, col)
    private screenToGrid(event: EventTouch): { row: number; col: number } | null {
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) return null;

        const screenPos = event.getUILocation();           // returns Vec2
        // Convert Vec2 to Vec3 (z = 0) for node‑space conversion
        const worldPos = new Vec3(screenPos.x, screenPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos); // returns Vec3

        const boardPixelWidth = this.cellSize * this.boardSize;
        const boardPixelHeight = this.cellSize * this.boardSize;
        // Shift so bottom‑left corner is (0,0)
        const x = localPos.x + boardPixelWidth / 2;
        const y = localPos.y + boardPixelHeight / 2;

        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);

        if (col >= 0 && col < this.boardSize && row >= 0 && row < this.boardSize) {
            return { row, col };
        }
        return null;
    }

    // --- Visual rendering ---
    private redrawAllPieces() {
        // Remove all children (clear the board)
        this.node.removeAllChildren();
        const board = this.game.getBoard();

        for (let r = 0; r < this.boardSize; r++) {
            for (let c = 0; c < this.boardSize; c++) {
                const cell = board[r][c];
                if (cell !== EMPTY) {
                    this.spawnPieceAt(r, c, cell as Player);
                }
            }
        }
    }

    private spawnPieceAt(row: number, col: number, player: Player) {
        if (!this.piecePrefab) return;

        const piece = instantiate(this.piecePrefab);
        piece.parent = this.node;

        // Calculate local position (center of cell)
        const pos = this.cellToLocal(row, col);
        piece.setPosition(pos.x, pos.y, 0);

        // Set piece color
        const sprite = piece.getComponent(Sprite);
        if (sprite) {
            sprite.color = player === BLACK ? Color.BLACK : Color.WHITE;
        }
    }

    // Convert grid (row,col) to local position based on anchor = 0.5
    private cellToLocal(row: number, col: number): Vec2 {
        const half = (this.boardSize - 1) / 2;
        const x = (col - half) * this.cellSize;
        const y = (row - half) * this.cellSize;
        return new Vec2(x, y);
    }
}