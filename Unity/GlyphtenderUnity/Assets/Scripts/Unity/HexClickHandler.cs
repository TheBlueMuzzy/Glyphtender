using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Handles tap input on hex tiles.
    /// Attached to each hex GameObject by BoardRenderer.
    /// 
    /// Handles glyphling selection (tap hex with your glyphling)
    /// and destination/cast selection (tap valid move/cast hex).
    /// 
    /// Only active when GameManager.CurrentInputMode is Tap.
    /// </summary>
    public class HexClickHandler : MonoBehaviour
    {
        public HexCoord Coord { get; set; }
        public BoardRenderer BoardRenderer { get; set; }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            // Only handle in tap mode
            if (GameManager.Instance == null) return;
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            // Don't allow board interaction during cycle mode
            if (GameManager.Instance.CurrentTurnState == GameTurnState.CycleMode)
                return;

            var state = GameManager.Instance.GameState;

            // First, check if there's a glyphling at this hex
            Glyphling glyphlingHere = BoardRenderer.GetGlyphlingAt(Coord);

            // If there's a glyphling here and it belongs to current player, select it
            if (glyphlingHere != null && glyphlingHere.Owner == state.CurrentPlayer)
            {
                // If we're mid-turn, reset the current move first
                var turnState = GameManager.Instance.CurrentTurnState;
                if (turnState == GameTurnState.GlyphlingSelected ||
                    turnState == GameTurnState.MovePending ||
                    turnState == GameTurnState.ReadyToConfirm)
                {
                    // Return any placed hand tile back to hand
                    HandTileDragHandler.ReturnCurrentlyPlacedTile();
                    GameManager.Instance.ResetMove();
                }

                GameManager.Instance.SelectGlyphling(glyphlingHere);
                return;
            }

            // Otherwise, check for valid moves/casts
            if (GameManager.Instance.ValidMoves.Contains(Coord))
            {
                GameManager.Instance.SelectDestination(Coord);
            }
            else if (GameManager.Instance.ValidCasts.Contains(Coord))
            {
                GameManager.Instance.SelectCastPosition(Coord);
            }
        }
    }
}