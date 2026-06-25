import { _decorator, Component, Node, instantiate, Prefab, UITransform, EventTouch, Vec2, Vec3, Sprite, Color } from 'cc';
import { OthelloGame, BLACK, WHITE, EMPTY, Player, Position } from './OthelloGame';

const { ccclass, property } = _decorator;

@ccclass('BoardView')
export class BoardView extends Component {
    @property({ type: Prefab })
    piecePrefab: Prefab = null!;    

    @property
    cellSize: number = 90;          

    @property({ type: Component })
    gameManager: Component = null!; 

    private game: OthelloGame = new OthelloGame();
    private boardSize: number = 8;

    public getGameLogic(): OthelloGame {
        return this.game;
    }

    onLoad() {
        this.redrawAllPieces();
        this.node.on(Node.EventType.TOUCH_END, this.onBoardClick, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onBoardClick, this);
    }

   private onBoardClick(event: EventTouch) {
        console.log("[BoardView] Papan game diklik!");

        if (this.gameManager) {
            const isSelected = (this.gameManager as any).isDifficultySelected;
            if (!isSelected) {
                console.log("[BoardView] Klik diabaikan karena papan masih terkunci!");
                return;
            }
        }

        // NEW! Proteksi: Abaikan klik jika bot sedang berpikir agar tidak terjadi tabrakan logika
        const isBotThinking = (this.gameManager as any).isBotThinking;
        if (isBotThinking) {
            console.log("[BoardView] Bot sedang berpikir, klik diabaikan.");
            return;
        }

        if (this.game.isGameOver()) {
            console.log("[BoardView] Klik diabaikan karena game sudah selesai.");
            return;
        }
        if (this.game.getCurrentPlayer() !== BLACK) {
            console.log("[BoardView] Klik diabaikan karena sekarang bukan giliran Player (Hitam).");
            return;
        }

        const cell = this.screenToGrid(event);
        if (!cell) {
            console.log("[BoardView] Klik di luar batas grid papan.");
            return;
        }

        // NEW! Validasi aturan Othello: Cek apakah kotak yang diklik memang KOSONG 
        // dan langkah tersebut sah (menghasilkan flips). Ini mencegah pemain menimpa keping.
        if (!this.game.isValidMove(cell.row, cell.col, BLACK)) {
            console.warn("[BoardView] Langkah TIDAK VALID: Kotak sudah terisi atau tidak bisa membalik bidak!");
            return; 
        }

        console.log(`[BoardView] Player melangkah di baris: ${cell.row}, kolom: ${cell.col}`);
        const flips = this.game.makeMove(cell.row, cell.col);
        
        if (flips) {
            console.log(`[BoardView] Langkah valid! Jumlah bidak yang dibalik: ${flips}`);
            this.redrawAllPieces();

            if (this.gameManager && typeof (this.gameManager as any).updateScoreUI === 'function') {
                (this.gameManager as any).updateScoreUI();
            }

            this.game.skipTurnIfNeeded();

            if (this.gameManager) {
                if (this.game.getCurrentPlayer() === WHITE && !this.game.isGameOver()) {
                    console.log("[BoardView] Giliran berubah ke Bot (White). Memicu makeAIMove...");
                    if (typeof (this.gameManager as any).makeAIMove === 'function') {
                        (this.gameManager as any).makeAIMove();
                    }
                }
            }
        }
    }

    private screenToGrid(event: EventTouch): { row: number; col: number } | null {
        const uiTransform = this.node.getComponent(UITransform);
        if (!uiTransform) return null;

        const screenPos = event.getUILocation();           
        const worldPos = new Vec3(screenPos.x, screenPos.y, 0);
        const localPos = uiTransform.convertToNodeSpaceAR(worldPos); 

        const boardPixelWidth = this.cellSize * this.boardSize;
        const boardPixelHeight = this.cellSize * this.boardSize;
        const x = localPos.x + boardPixelWidth / 2;
        const y = localPos.y + boardPixelHeight / 2;

        const col = Math.floor(x / this.cellSize);
        const row = Math.floor(y / this.cellSize);

        if (col >= 0 && col < this.boardSize && row >= 0 && row < this.boardSize) {
            return { row, col };
        }
        return null;
    }

    public redrawAllPieces() { 
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

        const pos = this.cellToLocal(row, col);
        piece.setPosition(pos.x, pos.y, 0);

        const sprite = piece.getComponent(Sprite);
        if (sprite) {
            sprite.color = player === BLACK ? Color.BLACK : Color.WHITE;
        }
    }

    private cellToLocal(row: number, col: number): Vec2 {
        const half = (this.boardSize - 1) / 2;
        const x = (col - half) * this.cellSize;
        const y = (row - half) * this.cellSize;
        return new Vec2(x, y);
    }
}