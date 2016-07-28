var Page = {};
// canvas variables
Page.$canvas = null;
Page.context = null;
Page.$bgCanvas = null;
Page.bgContext = null;
Page.canvasWidth = 600;
Page.canvasHeight = 600;
Page.boardLength = 8;
Page.blockSize = 75;
Page.triangleLength = 12;
Page.animationSpeed = 30;
Page.isAnimating = false;
Page.isGameOver = false;
Page.highlightMoveColor = 'SaddleBrown';
Page.blockColor = ['rgba(254, 245, 210, 1)', 'rgba(216, 172, 116, 1)'];
// player
Page.selectedPiece = null;
Page.player1Pieces = null;
Page.player2Pieces = null;
Page.playerTurn = 0;
Page.player1InCheck = false;
Page.player2InCheck = false;
Page.moveHistory = [];
// options
Page.hideHighlights = false;
Page.enableAnimations = true;

Page.initialize = function () {
    Page.$canvas = $('#chess-piece-canvas');
    Page.context = Page.$canvas[0].getContext('2d');
    Page.$bgCanvas = $('#chess-background-canvas');
    Page.bgContext = Page.$bgCanvas[0].getContext('2d');

    Page.createPieces();
    Page.attachCanvasListener();
    Page.attachButtonListeners();
    Page.initializeGameOverModal();
    Page.drawBoard();
    Page.drawPieces();
    Page.calculateAllMoves();
};

//#region Setup

Page.createPieces = function () {
    var pieceTypes = [Rook, Knight, Bishop, Queen, King, Bishop, Knight, Rook];
    Page.player1Pieces = [];
    Page.player2Pieces = [];

    // power pieces
    for (var i = 0; i < pieceTypes.length; i++) {
        Page.createPiece(Page.player1Pieces, 1, pieceTypes[i], 7, i);
        Page.createPiece(Page.player2Pieces, 2, pieceTypes[i], 0, i);
    }

    // pawns
    for (var i = 0; i < Page.boardLength; i++) {
        Page.createPiece(Page.player1Pieces, 1, Pawn, 6, i);
        Page.createPiece(Page.player2Pieces, 2, Pawn, 1, i);
    }
};

//#region Event Listeners

Page.attachCanvasListener = function () {
    Page.$canvas.on('mouseup', function (e) {
        if (Page.isGameOver || Page.isAnimating) {
            // wait until the piece is finished moving before trying to make another move
            return;
        }

        var col = Math.floor(e.offsetX / Page.blockSize);
        var row = Math.floor(e.offsetY / Page.blockSize);

        if (Page.selectedPiece) {
            if (Page.validateMove(Page.selectedPiece, row, col)) {
                var move = Page.getMove(Page.selectedPiece, row, col);
                if (Page.enableAnimations) {
                    var pieces = [Page.selectedPiece];
                    var dest = [[row, col]];
                    var callback = function () { return Page.updateAfterMove(move) };
                    if (move.castlingRook) {
                        pieces.push(move.castlingRook);
                        dest.push(move.rookEndLoc);
                    }
                    Page.animateMovement(pieces, dest, callback);
                } else {
                    Page.updateAfterMove(move);
                }
                return;
            } else {
                Page.selectedPiece = null;
            }
        }

        if (Page.playerTurn % 2 === 0) {
            Page.selectedPiece = Page.getPlayer1Piece(row, col);
        } else {
            Page.selectedPiece = Page.getPlayer2Piece(row, col);
        }

        Page.drawPieces();

        if (!Page.selectedPiece) {
            return;
        }

        if (!Page.hideHighlights) {
            var possibleMoves = Page.selectedPiece.moves;
            // highlight clicked piece
            Page.highlightSelected();
            // highlight possible moves
            Page.drawMoveOptions(possibleMoves);
        }
    });
};

Page.attachButtonListeners = function () {
    $('#undo-button').on('click', function (e) {
        if (Page.isGameOver || Page.isAnimating) return;

        var length = Page.moveHistory.length;
        if (length > 0) {
            var lastMove = Page.moveHistory[length - 1];
            var piece = lastMove.piece;

            if (Page.enableAnimations) {
                var callback = function () { return Page.updateAfterUndo() };
                var pieces = [piece];
                var dest = [[lastMove.fromRow, lastMove.fromCol]];
                if (lastMove.castlingRook) {
                    pieces.push(lastMove.castlingRook);
                    dest.push([lastMove.castlingFromRow, lastMove.castlingFromCol]);
                }
                Page.animateMovement(pieces, dest, callback);
            } else {
                Page.updateAfterUndo();
            }
        }
    });

    $('#restart-button').on('click', function (e) {
        Page.gameOver();
        this.isGameOver = false;
    });
};

Page.initializeGameOverModal = function () {
    $('#game-over-modal').on('show.bs.modal', function (e) {
        $(this).find('#confirm-replay-game').on('click', function () {
            Page.resetGame();
            $('#game-over-modal').modal('hide');
        });
    });
};

//#endregion Event Listeners

//#endregion Setup

//#region Canvas Drawing

Page.drawBoard = function () {
    Page.bgContext.clearRect(0, 0, Page.canvasWidth, Page.canvasHeight);
    Page.bgContext.beginPath();
    for (var i = 0; i < Page.boardLength; i++) {
        for (var j = 0; j < Page.boardLength; j++) {
            Page.bgContext.fillStyle = Page.blockColor[(i + j) % 2];
            Page.bgContext.fillRect(Page.blockSize * i, Page.blockSize * j, Page.blockSize, Page.blockSize);
        }
    }
    Page.bgContext.closePath();
};

Page.drawPieces = function () {
    // draw the pieces separately b/c players can have a different number of pieces
    Page.context.clearRect(0, 0, Page.canvasWidth, Page.canvasHeight);
    Page.context.font = '60px Arial Unicode MS';
    // draw player 1 pieces (white)
    for (var i = 0; i < Page.player1Pieces.length; i++) {
        var p = Page.player1Pieces[i];
        Page.drawText(p.symbol, p.loc[1], p.loc[0]);
    }

    // draw player 2 pieces (black)
    for (var i = 0; i < Page.player2Pieces.length; i++) {
        var p = Page.player2Pieces[i];
        Page.drawText(p.symbol, p.loc[1], p.loc[0]);
    }
};

Page.highlightSelected = function () {
    Page.eraseSquare(Page.selectedPiece.loc[1], Page.selectedPiece.loc[0]);
    Page.context.save();
    Page.context.shadowColor = Page.highlightMoveColor;
    Page.context.shadowBlur = 5;
    Page.drawText(Page.selectedPiece.symbol, Page.selectedPiece.loc[1], Page.selectedPiece.loc[0]);
    Page.context.restore();
};

Page.drawMoveOptions = function (moves) {
    moves = moves || [];
    Page.context.save();
    Page.context.fillStyle = Page.highlightMoveColor;
    var shift = Page.blockSize / 2;

    for (var i = 0; i < moves.length; i++) {
        if (moves[i].takenByOpp) {
            Page.drawMoveCaptureOption(moves[i]);
            continue;
        }

        if (moves[i].enPassant) {
            Page.context.font = '18px Arial Unicode MS';
            Page.context.fillText('E', moves[i].col * Page.blockSize + shift - 7, moves[i].row * Page.blockSize + shift + 7);
            Page.drawMoveCaptureOption(moves[i]);
            continue;
        }

        Page.context.beginPath();
        Page.context.arc(moves[i].col * Page.blockSize + shift, moves[i].row * Page.blockSize + shift, 10, 0, 2 * Math.PI);
        Page.context.fill();
        Page.context.closePath();
    }

    Page.context.restore();
};

Page.drawMoveCaptureOption = function (move) {
    // draw four small triangles in the corner of the given square
    var x = move.col * Page.blockSize;
    var y = move.row * Page.blockSize;

    // top left
    Page.context.beginPath();
    Page.context.moveTo(x, y);
    Page.context.lineTo(x, y + Page.triangleLength);
    Page.context.lineTo(x + Page.triangleLength, y);

    // top right
    Page.context.moveTo(x + Page.blockSize, y);
    Page.context.lineTo(x + Page.blockSize, y + Page.triangleLength);
    Page.context.lineTo(x + Page.blockSize - Page.triangleLength, y);

    // bottom left
    Page.context.moveTo(x, y + Page.blockSize);
    Page.context.lineTo(x, y + Page.blockSize - Page.triangleLength);
    Page.context.lineTo(x + Page.triangleLength, y + Page.blockSize);

    // bottom right
    Page.context.moveTo(x + Page.blockSize, y + Page.blockSize);
    Page.context.lineTo(x + Page.blockSize, y + Page.blockSize - Page.triangleLength);
    Page.context.lineTo(x + Page.blockSize - Page.triangleLength, y + Page.blockSize);
    Page.context.fill();
    Page.context.closePath();
};

Page.drawText = function (text, col, row) {
    Page.context.fillText(text, col * Page.blockSize + 8, row * Page.blockSize + 58);
};

Page.eraseSquare = function (col, row) {
    Page.context.clearRect(col * Page.blockSize, row * Page.blockSize, Page.blockSize, Page.blockSize);
};

Page.drawAnimation = function (exclude, text, x, y) {
    Page.drawPieces();

    // we need to separate erase and draw so that we don't erase the square
    // a piece is traveling through (will only happen when undoing castling).
    // erase moving piece(s) from old location
    for (var i = 0; i < exclude.length; i++) {
        Page.eraseSquare(exclude[i].loc[1], exclude[i].loc[0]);
    }
    // draw moving piece(s) en route to new location
    for (var i = 0; i < exclude.length; i++) {
        Page.context.fillText(text[i], exclude[i].loc[1] * Page.blockSize + 8 + y[i], exclude[i].loc[0] * Page.blockSize + 58 + x[i]);
    }
};

Page.animateMovement = function (pieces, dest, callback) {
    var x1 = [];
    var y1 = [];
    var distX = [];
    var distY = [];
    var dx = [];
    var dy = [];
    var tempX = [];
    var tempY = [];
    var text = [];
    Page.isAnimating = true;

    for (var i = 0; i < pieces.length; i++) {
        // calculate how far the piece needs to travel to get to the new location
        x1.push(pieces[i].loc[0]);
        y1.push(pieces[i].loc[1]);
        distX.push(dest[i][0] * Page.blockSize - x1[i] * Page.blockSize);
        distY.push(dest[i][1] * Page.blockSize - y1[i] * Page.blockSize);
        // calculate how far the piece should move with each new frame
        dx.push(distX[i] / Page.animationSpeed);
        dy.push(distY[i] / Page.animationSpeed);
        tempX.push(0);
        tempY.push(0);
        text.push(pieces[i].symbol)
    }

    var intervalID = window.setInterval(function () {
        for (var i = 0; i < pieces.length; i++) {
            if (tempX[i] === distX[i] && tempY[i] === distY[i]) {
                window.clearInterval(intervalID);
                Page.isAnimating = false;

                if (typeof (callback) === 'function') {
                    callback.call();
                }

                return;
            }

            if (tempX[i] !== distX[i]) {
                tempX[i] += dx[i];
            }

            if (tempY[i] !== distY[i]) {
                tempY[i] += dy[i];
            }
        }

        Page.drawAnimation(pieces, text, tempX, tempY);
    }, 10);
};

//#endregion Canvas Drawing

//#region Capturing

Page.removeIfCapturing = function (row, col) {
    // if the position is filled, the player is capturing a piece
    var removedPiece = null;
    if (Page.playerTurn % 2 === 0) {
        removedPiece = Page.getPlayer2Piece(row, col);
        Page.removePieceFromPlayer(Page.player2Pieces, removedPiece);
    } else {
        removedPiece = Page.getPlayer1Piece(row, col);
        Page.removePieceFromPlayer(Page.player1Pieces, removedPiece);
    }

    return removedPiece;
};

Page.removePieceFromPlayer = function (playerPieces, piece) {
    if (!!piece) {
        // capturing, remove the piece from player
        var index = playerPieces.indexOf(piece);

        if (index == -1) {
            console.log('error finding piece to remove');
            return;
        }

        playerPieces.splice(index, 1);

        if (piece.pieceType === 'King') {
            console.log('King captured! Game over');
            Page.gameOver('Game Over!');
        }
    }
};

//#endregion Capturing

//#region Movement

Page.calculateAllMoves = function () {
    Page.player1Pieces.forEach(function (o) { o.updateMoves(); });
    Page.player2Pieces.forEach(function (o) { o.updateMoves(); });

    // to check if castling is possible, we need every other piece to have
    // the most up-to-date possible moves. So we need to update the king's
    // possible moves last.
    Page.getPlayer1King().updateMoves();
    Page.getPlayer2King().updateMoves();
};

Page.calculateAllMovesOfPlayer = function (playerPieces) {
    playerPieces.forEach(function (o) { o.updateMoves(); });
    playerPieces.filter(function (o) { return o.pieceType === 'King'; })[0].updateMoves();
};

Page.isSpaceBlocked = function (row, col, player) {
    // make sure the player doesn't have a piece blocking a move
    // similar to pawn check above but with consideration of player turn
    // returns: 0 if not blocked
    // 			1 if blocked by opponent (can be captured)
    //			2 if blocked by self
    if (player === 1) {
        if (Page.getPlayer1Piece(row, col)) return 2;
        if (Page.getPlayer2Piece(row, col)) return 1;
    } else {
        if (Page.getPlayer1Piece(row, col)) return 1;
        if (Page.getPlayer2Piece(row, col)) return 2;
    }

    return 0;
};

Page.findDiagonalMoves = function (piece) {
    // returns: array of all possible diagonal moves
    var movementList = [];
    var player = piece.player;
    var currPos = piece.loc.slice(0);
    var row = currPos[0];
    var col = currPos[1];
    var maxLength = Page.boardLength - 1;
    var minLength = 0;

    // above piece and left
    while (row > minLength && col > minLength) {
        row -= 1;
        col -= 1;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    // above piece and right
    row = currPos[0];
    col = currPos[1];
    while (row > minLength && col < maxLength) {
        row -= 1;
        col += 1;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    // below piece and left
    row = currPos[0];
    col = currPos[1];
    while (row < maxLength && col > minLength) {
        row += 1;
        col -= 1;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    // below piece and right
    row = currPos[0];
    col = currPos[1];
    while (row < maxLength && col < maxLength) {
        row += 1;
        col += 1;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    return movementList;
};

Page.findVerticalHorizontalMoves = function (piece) {
    // returns: array of all possible vertical and horizontal moves
    var movementList = [];
    var player = piece.player;
    var currPos = piece.loc.slice(0);
    var row = currPos[0];
    var col = currPos[1];

    // down
    for (var i = currPos[0] + 1; i < Page.boardLength; i++) {
        row = i;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    // up
    row = currPos[0];
    col = currPos[1];
    for (var i = currPos[0] - 1; i >= 0; i--) {
        row = i;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    // right
    row = currPos[0];
    col = currPos[1];
    for (var i = currPos[1] + 1; i < Page.boardLength; i++) {
        col = i;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    // left
    row = currPos[0];
    col = currPos[1];
    for (var i = currPos[1] - 1; i >= 0; i--) {
        col = i;
        var breakAfterAdd = Page.addMoveIfNotBlocked(movementList, row, col, player);
        if (breakAfterAdd) break;
    }

    return movementList;
};

Page.addMoveIfNotBlocked = function (movementList, row, col, player) {
    var shouldBreak = true;
    if (row >= 0 && row < Page.boardLength && col >= 0 && col < Page.boardLength) {
        var isBlockedResult = Page.isSpaceBlocked(row, col, player);
        if (isBlockedResult === 0) {
            movementList.push(new Move(row, col, { takenByOpp: false }));
            shouldBreak = false;
        } else if (isBlockedResult === 1) {
            movementList.push(new Move(row, col, { takenByOpp: true }));
        }
    }

    return shouldBreak;
};

//#region Validation

Page.determineCheck = function () {
    if (Page.playerTurn % 2 === 0) {
        var p1King = Page.getPlayer1King();
        if (!p1King) return;
        Page.player1InCheck = Page.doesMoveResultInCheck(p1King.loc[0], p1King.loc[1], Page.player2Pieces);
    } else {
        var p2King = Page.getPlayer2King();
        if (!p2King) return;
        Page.player2InCheck = Page.doesMoveResultInCheck(p2King.loc[0], p2King.loc[1], Page.player1Pieces);
    }
};

Page.doesMoveResultInCheck = function (row, col, opponentPieces, excludeRow, excludeCol) {
    // excludeRow and excludeCol are optional. If they are not set, we set them to -1
    // so they can't match the location of any piece.
    // These variables are used to indicate that a piece at this location can be
    // captured and would eliminate check.
    var checkExists = false;
    if (row === excludeRow && col === excludeCol) {
        excludeRow = -1;
        excludeCol = -1;
    }

    for (var i = 0; i < opponentPieces.length; i++) {
        var moves = opponentPieces[i].moves;
        if (excludeRow === opponentPieces[i].loc[0] && excludeCol === opponentPieces[i].loc[1]) {
            continue;
        }
        for (var j = 0; j < moves.length; j++) {
            if (row == moves[j].row && col == moves[j].col) {
                checkExists = true;
                break;
            }
        }

        if (checkExists) {
            break;
        }
    }

    return checkExists;
};

Page.validateMove = function (piece, row, col) {
    // check to see if the given row,col is one of the piece's moves
    var match = Page.getMove(piece, row, col);
    return !!match;
};

Page.findValidMoves = function () {
    // Loop through all possible moves for the current player's pieces.
    // "Pretend" to take a move and then recalculate the opponent's moves
    // and then determine if check still exists. If it does, the move is not valid.
    // If it doesn't, the move removes check and is valid. Set the pieces moves
    // to only the valid moves.
    // The king needs to be handled special because we need to ensure that if it
    // makes a move by capturing an opponent's piece, that it does not end up in check.
    var king = null;
    var playerPieces = null;
    var oppPieces = null;
    var validMovesExist = false;
    var playerInCheck = false;

    if (Page.playerTurn === 0) {
        king = Page.getPlayer1King();
        playerPieces = Page.player1Pieces;
        oppPieces = Page.player2Pieces;
        playerInCheck = Page.player1InCheck;
    } else {
        king = Page.getPlayer2King();
        playerPieces = Page.player2Pieces;
        oppPieces = Page.player1Pieces;
        playerInCheck = Page.player2InCheck;
    }

    for (var i = 0; i < playerPieces.length; i++) {
        if (playerPieces[i].pieceType === 'King') continue;

        var moves = playerPieces[i].moves;
        var validMoves = [];

        for (var j = 0; j < moves.length; j++) {
            var row = moves[j].row;
            var col = moves[j].col;
            var oldRow = playerPieces[i].loc[0];
            var oldCol = playerPieces[i].loc[1];

            // temporarily move piece then recalculate the opponents moves
            playerPieces[i].loc = [row, col];
            Page.calculateAllMovesOfPlayer(oppPieces);

            if (!Page.doesMoveResultInCheck(king.loc[0], king.loc[1], oppPieces, row, col)) {
                validMoves.push(moves[j]);
                validMovesExist = true;
            }

            playerPieces[i].loc = [oldRow, oldCol];
        }

        playerPieces[i].moves = validMoves;
    }

    var validMoves = [];
    for (var i = 0; i < king.moves.length; i++) {
        var row = king.moves[i].row;
        var col = king.moves[i].col;
        var oldRow = king.loc[0];
        var oldCol = king.loc[1];
        var oppPiece = null;
        var oppPieceOldRow = -1;
        var oppPieceOldCol = -1;

        // temporarily move king then recalculate the opponents moves
        king.loc = [row, col];

        // temporarily remove an adjacent opponent's piece to see if the king
        // captured this piece, would he then be in check
        for (var j = 0; j < oppPieces.length; j++) {
            if (oppPieces[j].loc[0] === row && oppPieces[j].loc[1] === col) {
                oppPiece = oppPieces.splice(j, 1)[0];
                break;
            }
        }

        Page.calculateAllMovesOfPlayer(oppPieces);

        if (!Page.doesMoveResultInCheck(king.loc[0], king.loc[1], oppPieces, row, col)) {
            validMoves.push(king.moves[i]);
            validMovesExist = true;
        }

        // restore the king and opponent piece to their original state
        king.loc = [oldRow, oldCol];
        if (oppPiece) {
            oppPieces.push(oppPiece);
        }
    }

    // set the king's valid moves
    king.moves = validMoves;

    if (!validMovesExist) {
        if (playerInCheck) {
            // No valid moves, game over
            Page.gameOver('Game Over!', 'There are no valid moves left. ');
        } else {
            // Stalemate, game over
            Page.gameOver('Stalemate!', 'There are no valid moves left. ');
        }
    }
};

//#endregion Validation

//#region Special Moves

Page.promotePawn = function (piece) {
    var p = piece.player;
    if (p === 1) {
        var playerPieces = Page.player1Pieces;
    } else {
        var playerPieces = Page.player2Pieces;
    }

    $('#promotion-modal').on('show.bs.modal', function (e) {
        $(this).find('#promote-btn-queen').on('click', function () {
            Page.removePieceFromPlayer(playerPieces, piece);
            Page.createPiece(playerPieces, p, Queen, piece.loc[0], piece.loc[1]);
            $('#promotion-modal').modal('hide');
        });

        $(this).find('#promote-btn-rook').on('click', function () {
            Page.removePieceFromPlayer(playerPieces, piece);
            Page.createPiece(playerPieces, p, Rook, piece.loc[0], piece.loc[1]);
            $('#promotion-modal').modal('hide');
        });

        $(this).find('#promote-btn-bishop').on('click', function () {
            Page.removePieceFromPlayer(playerPieces, piece);
            Page.createPiece(playerPieces, p, Bishop, piece.loc[0], piece.loc[1]);
            $('#promotion-modal').modal('hide');
        });

        $(this).find('#promote-btn-knight').on('click', function () {
            Page.removePieceFromPlayer(playerPieces, piece);
            Page.createPiece(playerPieces, p, Knight, piece.loc[0], piece.loc[1]);
            $('#promotion-modal').modal('hide');
        });
    });

    $('#promotion-modal').on('hide.bs.modal', function (e) {
        $(this).find('button').off();
        $(this).off('show.bs.modal');
        $(this).off('hide.bs.modal');
        Page.drawPieces();
    });

    $('#promotion-modal').modal({
        keyboard: false,
        show: true
    });
};

Page.checkEnPassant = function (pawn) {
    // If the opponent moves a pawn two spaces from its starting position and a
    // friendly pawn could have captured it had the pawn moved only one space,
    // the friendly pawn can now perform the 'en passant' move to capture the
    // opponents pawn 'in passing'. This move must be made at the very next turn
    // or the right to do so is lost.
    var oppPawnRight = null;
    var oppPawnLeft = null;
    var lastMove = Page.moveHistory.slice(-1)[0];
    var dir = 0;
    var enPassantMove = null;

    if (pawn.player === 1) {
        oppPawnRight = Page.getPlayer2Piece(pawn.loc[0], pawn.loc[1] + 1);
        oppPawnLeft = Page.getPlayer2Piece(pawn.loc[0], pawn.loc[1] - 1);
        dir = -1;
    } else {
        oppPawnRight = Page.getPlayer1Piece(pawn.loc[0], pawn.loc[1] + 1);
        oppPawnLeft = Page.getPlayer1Piece(pawn.loc[0], pawn.loc[1] - 1);
        dir = 1;
    }

    if (oppPawnRight && oppPawnRight.performedDoubleStep
        && lastMove.row === oppPawnRight.loc[0] && lastMove.col === oppPawnRight.loc[1]) {
        enPassantMove = new Move(pawn.loc[0] + dir, pawn.loc[1] + 1, { takenByOpp: false, enPassant: true });
    }

    if (oppPawnLeft && oppPawnLeft.performedDoubleStep
        && lastMove.row === oppPawnLeft.loc[0] && lastMove.col === oppPawnLeft.loc[1]) {
        enPassantMove = new Move(pawn.loc[0] + dir, pawn.loc[1] - 1, { takenByOpp: false, enPassant: true });
    }

    return enPassantMove;
};

Page.checkCastling = function (king) {
    if (!king.firstMove) return;
    var rooks = [];
    var availRooks = [];
    var moves = [];
    var playerPieces = [];
    var oppPieces = [];

    // find the rook(s) if the king is not in check
    if (king.player === 1) {
        if (Page.player1InCheck) return;
        playerPieces = Page.player1Pieces;
        oppPieces = Page.player2Pieces;
    } else {
        if (Page.player2InCheck) return;
        playerPieces = Page.player2Pieces;
        oppPieces = Page.player1Pieces;
    }

    rooks = playerPieces.filter(function (o) { return o.pieceType === 'Rook' });

    availRooks = rooks.filter(function (o) { return o.firstMove });

    if (availRooks.length === 0) return;

    availRooks.forEach(function (rook) {
        // left rook
        if (rook.loc[1] === 0) {
            if (Page.doesMoveResultInCheck(rook.loc[0], 2, oppPieces)) return;

            for (var i = 1; i < king.loc[1]; i++) {
                if (Page.isSpaceBlocked(rook.loc[0], i, rook.player) !== 0) return;
                if (Page.doesMoveResultInCheck(rook.loc[0], i, oppPieces)) return;
            }

            moves.push(new Move(rook.loc[0], 2, { takenByOpp: false, castling: true, castlingRook: rook, rookEndLoc: [rook.loc[0], 3] }));
        }

        // right rook
        if (rook.loc[1] === 7) {
            if (Page.doesMoveResultInCheck(rook.loc[0], 6, oppPieces)) return;

            for (var i = 6; i > king.loc[1]; i--) {
                if (Page.isSpaceBlocked(rook.loc[0], i, rook.player) !== 0) return;
                if (Page.doesMoveResultInCheck(rook.loc[0], i, oppPieces)) return;
            }

            moves.push(new Move(rook.loc[0], 6, { takenByOpp: false, castling: true, castlingRook: rook, rookEndLoc: [rook.loc[0], 5] }));
        }
    });

    return moves.length === 0 ? null : moves;
};

//#endregion Special Moves

//#endregion Movement

//#region Getters

Page.getPlayer1Piece = function (row, col) {
    var match = Page.player1Pieces.filter(function (o) {
        return (o.loc[0] === row && o.loc[1] === col);
    })[0];
    return match;
};

Page.getPlayer2Piece = function (row, col) {
    var match = Page.player2Pieces.filter(function (o) {
        return (o.loc[0] === row && o.loc[1] === col);
    })[0];
    return match;
};

Page.getPlayer1King = function () {
    var king = Page.player1Pieces.filter(function (o) {
        return o.pieceType === 'King';
    })[0];
    return king;
};

Page.getPlayer2King = function () {
    var king = Page.player2Pieces.filter(function (o) {
        return o.pieceType === 'King';
    })[0];
    return king;
};

Page.getMove = function (piece, row, col) {
    var possibleMoves = piece.moves;
    var match = possibleMoves.filter(function (o) {
        return (o.row == row && o.col == col);
    })[0];

    return match;
};

//#endregion Getters

//#region Helpers

Page.updateAfterMove = function (move) {
    var fromRow = Page.selectedPiece.loc[0];
    var fromCol = Page.selectedPiece.loc[1];
    var row = move.row;
    var col = move.col;
    var firstMove = Page.selectedPiece.firstMove;
    var castlingFromRow = null;
    var castlingFromCol = null;
    var capturedPiece = Page.removeIfCapturing(row, col);

    // update the piece position
    Page.selectedPiece.updateLoc(row, col);

    // check for special move conditions
    // En Passant
    if (move.enPassant) {
        if (Page.selectedPiece.player === 1) {
            capturedPiece = Page.removeIfCapturing(row + 1, col);
        }
        else {
            capturedPiece = Page.removeIfCapturing(row - 1, col);
        }
    }

    // Castling
    if (move.castling) {
        castlingFromRow = move.castlingRook.loc[0];
        castlingFromCol = move.castlingRook.loc[1];

        move.castlingRook.updateLoc(move.rookEndLoc[0], move.rookEndLoc[1]);
    }

    // record the move
    Page.moveHistory.push({
        fromRow: fromRow,
        fromCol: fromCol,
        row: row,
        col: col,
        player: Page.selectedPiece.player,
        firstMove: firstMove,
        castlingRook: move.castlingRook || null,
        castlingFromRow: castlingFromRow,
        castlingFromCol: castlingFromCol,
        capturedPiece: capturedPiece,
        piece: Page.selectedPiece
    });

    if (Page.isGameOver) {
        return;
    }

    // update game state
    Page.playerTurn = (Page.playerTurn + 1) % 2;
    Page.calculateAllMoves();
    Page.determineCheck();
    // make sure there is no move that leaves the king in check
    Page.findValidMoves();
    Page.drawPieces();
    Page.selectedPiece = null;
};

Page.updateAfterUndo = function () {
    var lastMove = Page.moveHistory.slice(-1)[0];
    var piece = lastMove.piece;

    Page.playerTurn = (Page.playerTurn + 1) % 2;
    Page.selectedPiece = null;

    piece.loc[0] = lastMove.fromRow;
    piece.loc[1] = lastMove.fromCol;

    if (lastMove.firstMove) {
        // reset first move
        piece.firstMove = lastMove.firstMove;
    }

    if (lastMove.castlingRook) {
        // reset effects of castling
        lastMove.castlingRook.firstMove = lastMove.firstMove;
        lastMove.castlingRook.loc[0] = lastMove.castlingFromRow;
        lastMove.castlingRook.loc[1] = lastMove.castlingFromCol;
    }

    if (lastMove.capturedPiece) {
        // re-add captured piece
        if (Page.playerTurn === 1) {
            Page.player1Pieces.push(lastMove.capturedPiece);
        } else {
            Page.player2Pieces.push(lastMove.capturedPiece);
        }
    }

    Page.drawPieces();
    Page.moveHistory.pop();
    Page.calculateAllMoves();
    Page.determineCheck();
    Page.findValidMoves();
};

Page.createPiece = function (playerPieces, player, pieceConstructor, row, col) {
    var piece = new pieceConstructor(row, col, player);
    playerPieces.push(piece);
};

//#endregion Helpers

//#region Options

Page.toggleHighlights = function () {
    Page.hideHighlights = !Page.hideHighlights;
    if (Page.hideHighlights) {
        Page.drawPieces();
    }
};

Page.toggleAnimations = function () {
    Page.enableAnimations = !Page.enableAnimations;
};

Page.restartOption = function () {
    Page.gameOver();
    this.isGameOver = false;
};

Page.openOptions = function () {
    $('#options-side-menu').css('width', '250px');
};

Page.closeOptions = function () {
    $('#options-side-menu').css('width', '0');
};

//#endregion Options

//#region Reset / Replay

Page.gameOver = function (title, body) {
    Page.isGameOver = true;
    $('#game-over-modal').find('.modal-title').text(title || 'New Game?');
    $('#game-over-modal').find('.modal-body p').text((body || '') + 'Would you like to start a new game?');
    $('#game-over-modal').modal('show');
};

Page.resetGame = function () {
    Page.selectedPiece = null;
    Page.player1Pieces = null;
    Page.player2Pieces = null;
    Page.playerTurn = 0;
    Page.player1InCheck = false;
    Page.player2InCheck = false;
    Page.moveHistory = [];
    Page.isAnimating = false;
    Page.isGameOver = false;

    Page.createPieces();
    Page.drawBoard();
    Page.drawPieces();
    Page.calculateAllMoves();
    Page.closeOptions();
};

//#endregion Reset / Replay

/**
* Move Object
**/

var Move = function (row, col, options) {
    this.row = row || 0;
    this.col = col || 0;
    // indicates whether this location is occupied by an opponents pieces
    options = options || {};
    this.takenByOpp = options.takenByOpp || false;
    this.enPassant = options.enPassant || false;
    this.castling = options.castling || false;
    this.castlingRook = options.castlingRook || null;
    this.rookEndLoc = options.rookEndLoc || null;
};

/**
* Pawn
**/

var Pawn = function (row, col, player) {
    this.pieceType = 'Pawn';
    this.loc = [row, col];
    this.player = player;
    this.firstMove = true;
    this.performedDoubleStep = false;
    this.moves = [];
    if (player === 1) {
        this.symbol = String.fromCharCode(parseInt('2659', 16)); // white
    } else {
        this.symbol = String.fromCharCode(parseInt('265F', 16)); // black
    }
};
Pawn.prototype.updateMoves = function () {
    var movementList = [];
    var tempRow = -1;
    var tempCol = -1;
    var dir = 0;
    var move = null;
    var enPassant = Page.checkEnPassant(this);

    if (this.player === 1) {
        dir = -1;
    } else {
        dir = 1;
    }

    // get standard forward movement options
    tempRow = this.loc[0] + dir;
    if (Page.isSpaceBlocked(tempRow, this.loc[1], this.player) === 0) {
        movementList.push(new Move(tempRow, this.loc[1], { takenByOpp: false }));
        if (this.firstMove) {
            tempRow = this.loc[0] + dir + dir;
            if (Page.isSpaceBlocked(tempRow, this.loc[1], this.player) === 0) {
                movementList.push(new Move(tempRow, this.loc[1], { takenByOpp: false }));
            }
        }
    }

    // check for capture diagonal option
    tempRow = this.loc[0] + dir;
    tempRowCol = this.loc[1] + dir;
    if (this.player === 1) {
        if (Page.getPlayer2Piece(tempRow, tempRowCol)) {
            movementList.push(new Move(tempRow, tempRowCol, { takenByOpp: true }));
        }
    } else {
        if (Page.getPlayer1Piece(tempRow, tempRowCol)) {
            movementList.push(new Move(tempRow, tempRowCol, { takenByOpp: true }));
        }
    }

    tempRow = this.loc[0] + dir;
    tempRowCol = this.loc[1] - dir;
    if (this.player === 1) {
        if (Page.getPlayer2Piece(tempRow, tempRowCol)) {
            movementList.push(new Move(tempRow, tempRowCol, { takenByOpp: true }));
        }
    } else {
        if (Page.getPlayer1Piece(tempRow, tempRowCol)) {
            movementList.push(new Move(tempRow, tempRowCol, { takenByOpp: true }));
        }
    }

    if (enPassant) movementList.push(enPassant);
    this.moves = movementList;
};
Pawn.prototype.updateLoc = function (row, col) {
    if (Math.abs(this.loc[0] - row) === 2 && this.loc[1] === col) {
        this.performedDoubleStep = true;
    } else {
        this.performedDoubleStep = false;
    }

    this.loc = [row, col];
    this.firstMove = false;

    if (row === 0 || row === 7) {
        Page.promotePawn(this);
    }
};

/**
* Knight
**/

var Knight = function (row, col, player) {
    this.pieceType = 'Knight';
    this.loc = [row, col];
    this.player = player;
    this.moves = [];
    if (player === 1) {
        this.symbol = String.fromCharCode(parseInt('2658', 16)); // white
    } else {
        this.symbol = String.fromCharCode(parseInt('265E', 16)); // black
    }
};
Knight.prototype.updateMoves = function () {
    var movementList = [];
    var moves = [[-2, -1, 1], [-1, -2, 2], [1, -2, 2], [2, -1, 1]];
    var currPos = this.loc.slice(0);
    for (var i = 0; i < moves.length; i++) {
        for (var j = 1; j < moves[i].length; j++) {
            var row = currPos[0] + moves[i][0];
            var col = currPos[1] + moves[i][j];
            Page.addMoveIfNotBlocked(movementList, row, col, this.player);
        }
    }

    this.moves = movementList;
};
Knight.prototype.updateLoc = function (row, col) {
    this.loc = [row, col];
};

/**
* Bishop
**/

var Bishop = function (row, col, player) {
    this.pieceType = 'Bishop';
    this.loc = [row, col];
    this.player = player;
    this.moves = [];
    if (player === 1) {
        this.symbol = String.fromCharCode(parseInt('2657', 16)); // white
    } else {
        this.symbol = String.fromCharCode(parseInt('265D', 16)); // black
    }
};
Bishop.prototype.updateMoves = function () {
    this.moves = Page.findDiagonalMoves(this);
};
Bishop.prototype.updateLoc = function (row, col) {
    this.loc = [row, col];
};

/**
* Rook
**/

var Rook = function (row, col, player) {
    this.pieceType = 'Rook';
    this.loc = [row, col];
    this.player = player;
    this.firstMove = true;
    this.moves = [];
    if (player === 1) {
        this.symbol = String.fromCharCode(parseInt('2656', 16)); // white
    } else {
        this.symbol = String.fromCharCode(parseInt('265C', 16)); // black
    }
};
Rook.prototype.updateMoves = function () {
    this.moves = Page.findVerticalHorizontalMoves(this);
};
Rook.prototype.updateLoc = function (row, col) {
    this.loc = [row, col];
    this.firstMove = false;
};

/**
* Queen
**/

var Queen = function (row, col, player) {
    this.pieceType = 'Queen';
    this.loc = [row, col];
    this.player = player;
    this.moves = [];
    if (player === 1) {
        this.symbol = String.fromCharCode(parseInt('2655', 16)); // white
    } else {
        this.symbol = String.fromCharCode(parseInt('265B', 16)); // black
    }
};
Queen.prototype.updateMoves = function () {
    var movementList = [];
    movementList = movementList.concat(Page.findDiagonalMoves(this));
    movementList = movementList.concat(Page.findVerticalHorizontalMoves(this));
    this.moves = movementList;
};
Queen.prototype.updateLoc = function (row, col) {
    this.loc = [row, col];
};

/**
* King
**/

var King = function (row, col, player) {
    this.pieceType = 'King';
    this.loc = [row, col];
    this.player = player;
    this.firstMove = true;
    this.moves = [];
    if (player === 1) {
        this.symbol = String.fromCharCode(parseInt('2654', 16)); // white
    } else {
        this.symbol = String.fromCharCode(parseInt('265A', 16)); // black
    }
};
King.prototype.updateMoves = function () {
    var movementList = [];
    var tempPos = this.loc.slice(0);

    // up left
    tempPos[0] -= 1;
    tempPos[1] -= 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    // up
    tempPos = this.loc.slice(0);
    tempPos[0] -= 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    // up right
    tempPos = this.loc.slice(0);
    tempPos[0] -= 1;
    tempPos[1] += 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    // right
    tempPos = this.loc.slice(0);
    tempPos[1] += 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    // down right
    tempPos = this.loc.slice(0);
    tempPos[0] += 1;
    tempPos[1] += 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    // down
    tempPos = this.loc.slice(0);
    tempPos[0] += 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    // down left
    tempPos = this.loc.slice(0);
    tempPos[0] += 1;
    tempPos[1] -= 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    // left
    tempPos = this.loc.slice(0);
    tempPos[1] -= 1;
    Page.addMoveIfNotBlocked(movementList, tempPos[0], tempPos[1], this.player);

    var castlingMoves = Page.checkCastling(this);
    if (castlingMoves) {
        movementList = movementList.concat(castlingMoves);
    }

    this.moves = movementList;
};
King.prototype.updateLoc = function (row, col) {
    this.loc = [row, col];
    this.firstMove = false;
};

$(document).on('ready', function () {
    Page.initialize();
});
