import { _decorator, Color, Component, Label, Node, AudioSource, AudioClip } from 'cc';
import { OthelloGame, WHITE, BLACK, EMPTY } from './OthelloGame'; 

const { ccclass, property } = _decorator;

@ccclass('GameManager')
export class GameManager extends Component {
    @property({ type: Label })
    scorePlayerLabel: Label = null!; 

    @property({ type: Label })
    scoreBotLabel: Label = null!;    

    @property({ type: Node })
    easyButtonNode: Node = null!;    
    @property({ type: Node })
    normalButtonNode: Node = null!;  
    @property({ type: Node })
    hardButtonNode: Node = null!;    

    @property({ type: Component })
    boardViewScript: Component = null!;

    //Status player menang kalah
    @property({ type: Label })
    statusLabel: Label = null!;

    @property({ type: AudioClip })
    moveClip: AudioClip = null!;

    @property({ type: AudioClip })
    winClip: AudioClip = null!;

    @property({ type: AudioClip })
    loseClip: AudioClip = null!; 

    private playClip(clip: AudioClip) {
        if (!clip) return;
        const audioSource = this.node.getComponent(AudioSource) 
                        ?? this.node.addComponent(AudioSource);
        audioSource.playOneShot(clip, 1.0);
    }

    public playMoveSound() {
        this.playClip(this.moveClip);
    }

    private gameLogic: OthelloGame | null = null;
    public isDifficultySelected: boolean = false;
    private isBotThinking: boolean = false;
    private currentDifficulty: string = "easy"; 

    // Matriks bobot untuk evaluasi posisi (Standard Othello Strategy)
    private readonly BOARD_WEIGHTS: number[][] = [
        [ 1000, -200, 100,  50,  50, 100, -200, 1000],
        [-200, -500, -50, -50, -50, -50, -500, -200],
        [ 100,  -50,  20,   10,  10,  20,  -50,  100],
        [  50,  -50,  10,   5,   5,   10,  -50,   50],
        [  50,  -50,  10,   5,   5,   10,  -50,   50],
        [ 100,  -50,  20,   10,  10,  20,  -50,  100],
        [-200, -500, -50, -50, -50, -50, -500, -200],
        [ 1000, -200, 100,  50,  50, 100, -200, 1000]
    ];

    start() {
        this.linkGameLogic();
        this.updateScoreUI();
    }

    private linkGameLogic() {
        if (this.boardViewScript) {
            const actualBoardScript = this.boardViewScript.node.getComponent("BoardView");
            if (actualBoardScript && typeof (actualBoardScript as any).getGameLogic === 'function') {
                this.gameLogic = (actualBoardScript as any).getGameLogic();
            }
        }
    }

    public setDifficulty(event: Event, customEventData: string) {
        this.currentDifficulty = customEventData || "easy";
        this.isDifficultySelected = true;

        if (this.easyButtonNode) this.easyButtonNode.active = false; 
        if (this.normalButtonNode) this.normalButtonNode.active = false; 
        if (this.hardButtonNode) this.hardButtonNode.active = false; 

        if (this.boardViewScript) {
            const actualBoardScript = this.boardViewScript.node.getComponent("BoardView");
            if (actualBoardScript && typeof (actualBoardScript as any).redrawAllPieces === 'function') {
                (actualBoardScript as any).redrawAllPieces(); 
            }
        }
        this.updateScoreUI();
    }

    public updateScoreUI() {
        if (!this.gameLogic) this.linkGameLogic();
        if (!this.gameLogic) return;
        const score = this.gameLogic.getScore();
        if (this.scorePlayerLabel) this.scorePlayerLabel.string = `${score.black}`;
        if (this.scoreBotLabel) this.scoreBotLabel.string = `${score.white}`;

        if (this.gameLogic.isGameOver()) {
            console.log("Game Over terdeteksi! Memanggil showGameOverUI...");
            this.showGameOverUI(score);
        }
    }

    public makeAIMove() {
        if (!this.gameLogic) this.linkGameLogic();

        console.log("makeAIMove dipanggil");


        if (!this.gameLogic || this.gameLogic.isGameOver() || this.isBotThinking) return;

        this.isBotThinking = true;

        let validMoves = this.getSimulatedValidMoves(this.gameLogic.getBoard(), WHITE);

        if (validMoves.length > 0) {
            let chosenMove: { row: number, col: number };

            if (this.currentDifficulty === "hard") {
                // HARD: Selalu yang terbaik (Alpha-Beta , Depth 5) tinggal diubah2 ?
                chosenMove = this.getBestMoveAlphaBeta(validMoves, 7); 
            } else if (this.currentDifficulty === "normal") {
                // NORMAL: Weight based (Roulette Wheel)
                chosenMove = this.getWeightedRandomMove(validMoves);
            } else {
                // EASY: Acak murni
                chosenMove = validMoves[Math.floor(Math.random() * validMoves.length)];
            }

            this.scheduleOnce(() => {
                this.gameLogic?.makeMove(chosenMove.row, chosenMove.col);
                const actualBoardScript = this.boardViewScript.node.getComponent("BoardView");
                (actualBoardScript as any)?.redrawAllPieces();

                this.playMoveSound();
                
                // 1. Update Score 
                this.updateScoreUI(); 
                
                // 2. PENTING: Cek game over secara eksplisit setelah langkah bot
                if (this.gameLogic?.isGameOver()) {
                    console.log("Bot melakukan langkah terakhir, game selesai.");
                    this.showGameOverUI(this.gameLogic.getScore());
                }
                
                this.gameLogic?.skipTurnIfNeeded();
                this.isBotThinking = false;

                // PENTING: Cek kembali apakah setelah langkah bot, game berakhir
                if (this.gameLogic?.isGameOver()) {
                    console.log("DEBUG: Game berakhir setelah langkah bot!");
                    this.showGameOverUI(this.gameLogic.getScore());
                } else if (this.gameLogic?.getCurrentPlayer() === WHITE) {
                    this.makeAIMove();
                }
            }, 0.5);
        } else {
            this.gameLogic.skipTurnIfNeeded();
            this.isBotThinking = false;
            this.updateScoreUI();
        }
    }

    // --- ALGORITMA NORMAL: Roulette Wheel ---
    private getWeightedRandomMove(moves: { row: number, col: number }[]): { row: number, col: number } {
        let moveData = moves.map(move => {
            const board = this.simulateMove(this.gameLogic!.getBoard(), move.row, move.col, 2); // 2 = WHITE
            let value = this.evaluateBoard(board, false);
            return { move, value };
        });

        // 1. Filter: Cari langkah yang memberikan nilai positif (+)
        let positiveMoves = moveData.filter(m => m.value > 0);

        if (positiveMoves.length > 0) {
            // Jika ada langkah positif, pilih salah satu dari mereka secara acak
            // (Tetap ada elemen acak agar bot Normal terasa bervariasi)
            let randomIndex = Math.floor(Math.random() * positiveMoves.length);
            return positiveMoves[randomIndex].move;
        } else {
            // 2. Jika semuanya negatif, pilih yang nilai negatifnya PALING KECIL (paling mendekati 0)
            // Sortir dari nilai tertinggi ke terendah (karena negatif, berarti yang paling dekat ke 0 ada di atas)
            moveData.sort((a, b) => b.value - a.value);
            return moveData[0].move;
        }
    }

    // --- ALGORITMA HARD: Alpha-Beta Pruning ---
    // Refactor: alphabeta sekarang menerima currentPlayer secara eksplisit.
    // WHITE = maximizing (bot), BLACK = minimizing (player).
    private getBestMoveAlphaBeta(moves: { row: number, col: number }[], depth: number): { row: number, col: number } {
        let bestMove = moves[0];
        let bestValue = -Infinity;
        const currentBoard = this.gameLogic!.getBoard();
        for (let move of moves) {
            // Bot (WHITE) sudah jalan, layer berikutnya giliran BLACK
            const nextBoard = this.simulateMove(currentBoard, move.row, move.col, WHITE);
            let moveValue = this.alphabeta(nextBoard, depth - 1, -Infinity, Infinity, BLACK);
            if (moveValue > bestValue) {
                bestValue = moveValue;
                bestMove = move;
            }
        }
        return bestMove;
    }

    // currentPlayer = siapa yang akan jalan di node ini
    private alphabeta(board: number[][], depth: number, alpha: number, beta: number, currentPlayer: number): number {
        const isMaximizing = currentPlayer === WHITE;
        const opponent = currentPlayer === WHITE ? BLACK : WHITE;

        if (depth === 0) return this.evaluateBoard(board, false);

        const moves = this.getSimulatedValidMoves(board, currentPlayer);

        if (moves.length === 0) {
            const opponentMoves = this.getSimulatedValidMoves(board, opponent);
            if (opponentMoves.length === 0) {
                return this.evaluateEndgame(board);
            }
            // Pass turn: depth TIDAK dikurangi (tidak ada langkah nyata)
            return this.alphabeta(board, depth, alpha, beta, opponent);
        }

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (let move of moves) {
                const nextBoard = this.simulateMove(board, move.row, move.col, WHITE);
                let evalScore = this.alphabeta(nextBoard, depth - 1, alpha, beta, BLACK);
                maxEval = Math.max(maxEval, evalScore);
                alpha = Math.max(alpha, evalScore);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (let move of moves) {
                const nextBoard = this.simulateMove(board, move.row, move.col, BLACK);
                let evalScore = this.alphabeta(nextBoard, depth - 1, alpha, beta, WHITE);
                minEval = Math.min(minEval, evalScore);
                beta = Math.min(beta, evalScore);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    // Menghitung skor di akhir game secara langsung
    private evaluateEndgame(board: number[][]): number {
        let whiteCount = 0, blackCount = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === WHITE) whiteCount++;
                else if (board[r][c] === BLACK) blackCount++;
            }
        }
        
        // Skoring mutlak: Kalau langkah ini bikin dia menang, kasih nilai besar
        if (whiteCount > blackCount) return 99999 + whiteCount; 
        if (blackCount > whiteCount) return -99999 - blackCount;
        return 0; // draw
    }

    private evaluateBoard(board: number[][], isEndgame: boolean = false): number {
        let score = 0;

        // Hitung jumlah keping untuk deteksi fase game
        let totalPieces = 0;
        let whiteCount = 0, blackCount = 0;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === WHITE) { whiteCount++; totalPieces++; }
                else if (board[r][c] === BLACK) { blackCount++; totalPieces++; }
            }
        }

        // FASE ENDGAME (>= 54 keping, atau dipaksa dari luar): hitung keping nyata, bukan posisi
        if (isEndgame || totalPieces >= 54) {
            return (whiteCount - blackCount) * 1000;
        }
        
        // 1. Positional Score (berdasarkan bobot sudut/tepi)
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === WHITE) score += this.BOARD_WEIGHTS[r][c];
                else if (board[r][c] === BLACK) score -= this.BOARD_WEIGHTS[r][c];
            }
        }

        // 2. Mobility Score — makin banyak pilihan langkah = makin bagus
        const botMoves = this.getSimulatedValidMoves(board, WHITE).length;
        const playerMoves = this.getSimulatedValidMoves(board, BLACK).length;
        const totalMoves = botMoves + playerMoves;
        if (totalMoves > 0) {
            score += ((botMoves - playerMoves) / totalMoves) * 200;
        }

        // 3. Stability Score — sudut yang dikuasai bot adalah stabil dan sangat bernilai
        score += this.countStableDiscs(board, WHITE) * 50;
        score -= this.countStableDiscs(board, BLACK) * 50;

        return score;
    }

    // Hitung keping yang sudah "terkunci" (tidak bisa dibalik lagi), prioritas sudut
    private countStableDiscs(board: number[][], player: number): number {
        const corners = [[0,0],[0,7],[7,0],[7,7]];
        let stable = 0;
        for (const [r, c] of corners) {
            if (board[r][c] === player) stable++;
        }
        return stable;
    }

    private simulateMove(currentBoard: number[][], row: number, col: number, player: number): number[][] {
        let newBoard = currentBoard.map(arr => arr.slice());
        newBoard[row][col] = player;
        const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        for (let dir of directions) {
            let r = row + dir[0], c = col + dir[1], toFlip = [];
            while (r >= 0 && r < 8 && c >= 0 && c < 8 && newBoard[r][c] !== EMPTY && newBoard[r][c] !== player) {
                toFlip.push({r, c});
                r += dir[0]; c += dir[1];
            }
            if (r >= 0 && r < 8 && c >= 0 && c < 8 && newBoard[r][c] === player) {
                for (let cell of toFlip) newBoard[cell.r][cell.c] = player;
            }
        }
        return newBoard;
    }

    private getSimulatedValidMoves(board: number[][], player: number): { row: number, col: number }[] {
        let moves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                if (board[r][c] === EMPTY && this.isSimulatedMoveValid(board, r, c, player)) moves.push({row: r, col: c});
            }
        }
        return moves;
    }

    private isSimulatedMoveValid(board: number[][], row: number, col: number, player: number): boolean {
        const directions = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
        const opponent = player === WHITE ? BLACK : WHITE;
        for (let dir of directions) {
            let r = row + dir[0], c = col + dir[1], hasOpponent = false;
            while (r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === opponent) {
                hasOpponent = true;
                r += dir[0]; c += dir[1];
            }
            if (hasOpponent && r >= 0 && r < 8 && c >= 0 && c < 8 && board[r][c] === player) return true;
        }
        return false;
    }

    private showGameOverUI(score: { black: number, white: number }) {
        console.log("DEBUG: Menampilkan hasil akhir...");

        if (!this.statusLabel) {
            console.error("ERROR: statusLabel tidak terhubung!");
            return;
        }

        // Ubah teks dan warna berdasarkan hasil
        if (score.black > score.white) {
            this.statusLabel.string = "YOU WIN!";
            this.statusLabel.color = Color.GREEN;
            this.playClip(this.winClip);
        } else if (score.white > score.black) {
            this.statusLabel.string = "YOU LOSE!";
            this.statusLabel.color = Color.RED;
            this.playClip(this.loseClip);
        } else {
            this.statusLabel.string = "DRAW!";
            this.statusLabel.color = Color.WHITE;
        }
    }
}