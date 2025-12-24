using UnityEngine;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Centralized input state tracking.
    /// Separates input/UI state from game state for clean architecture.
    /// 
    /// Game state (whose turn, scores) lives in GameManager.
    /// Input state (who's dragging what) lives here.
    /// 
    /// This separation enables future multiplayer: game state syncs over network,
    /// input state stays local to each client.
    /// </summary>
    public class InputStateManager : MonoBehaviour
    {
        public static InputStateManager Instance { get; private set; }

        /// <summary>
        /// True if any glyphling is currently being dragged.
        /// </summary>
        public bool IsGlyphlingDragging { get; set; }

        /// <summary>
        /// True if any hand tile is currently being dragged.
        /// </summary>
        public bool IsTileDragging { get; set; }

        /// <summary>
        /// Reference to the HandTileDragHandler that has placed a tile on the board.
        /// Used to return tile to hand when move is cancelled.
        /// </summary>
        public HandTileDragHandler CurrentlyPlacedTile { get; set; }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        /// <summary>
        /// Resets all input state. Call when game restarts or turn changes.
        /// </summary>
        public void Reset()
        {
            IsGlyphlingDragging = false;
            IsTileDragging = false;
            CurrentlyPlacedTile = null;
        }

        /// <summary>
        /// Ensures InputStateManager exists in scene.
        /// </summary>
        public static InputStateManager EnsureExists()
        {
            if (Instance == null)
            {
                var go = new GameObject("InputStateManager");
                Instance = go.AddComponent<InputStateManager>();
            }
            return Instance;
        }
    }
}