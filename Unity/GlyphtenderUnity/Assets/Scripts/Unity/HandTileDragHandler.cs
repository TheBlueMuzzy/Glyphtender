using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Handles drag and drop input for hand tiles.
    /// Only active when GameManager.CurrentInputMode is Drag.
    /// Works with both quad prefabs (with textures) and cylinder fallbacks.
    /// </summary>
    public class HandTileDragHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }
        public int Index { get; set; }
        public char Letter { get; set; }

        private bool _isDragging;
        private bool _isPlaced;
        private Vector3 _originalPosition;
        private Vector3 _originalScale;
        private Quaternion _originalRotation;
        private Transform _originalParent;
        private int _originalLayer;
        private Material _originalMaterial;
        private Camera _mainCamera;
        private HexCoord? _hoveredHex;
        private Renderer _renderer;
        private int _dragFingerId = -1;  // Track which finger started the drag
        private bool _isQuadPrefab;  // True if this is a quad prefab, false if cylinder

        /// <summary>
        /// True if any hand tile is currently being dragged.
        /// Used by TouchInputController to disable panning.
        /// </summary>
        public static bool IsDraggingTile
        {
            get
            {
                if (InputStateManager.Instance == null) return false;
                return InputStateManager.Instance.IsTileDragging;
            }
        }

        private void Start()
        {
            _mainCamera = Camera.main;
            _renderer = GetComponent<Renderer>();
            if (_renderer != null)
            {
                _originalMaterial = _renderer.material;
            }
            _originalLayer = gameObject.layer;

            // Detect if this is a quad prefab (has MeshFilter with Quad mesh) or cylinder
            var meshFilter = GetComponent<MeshFilter>();
            _isQuadPrefab = meshFilter != null && meshFilter.sharedMesh != null &&
                           meshFilter.sharedMesh.name.Contains("Quad");

            // Ensure InputStateManager exists
            InputStateManager.EnsureExists();
        }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            // Only handle in drag mode
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Drag)
                return;

            // Block input if it's not the local player's turn in online mode
            if (NetworkedGameManager.Instance != null &&
                NetworkedGameManager.Instance.IsOnlineGame &&
                !NetworkedGameManager.Instance.IsLocalPlayerTurn)
                return;

            // Only allow in states where tile selection is valid
            var state = GameManager.Instance.CurrentTurnState;
            if (state != GameTurnState.MovePending &&
                state != GameTurnState.ReadyToConfirm)
            {
                Debug.Log("Move your glyphling first!");
                return;
            }

            // If another tile is already placed (and it's not this one), return it to hand first
            var currentlyPlaced = InputStateManager.Instance.CurrentlyPlacedTile;
            if (currentlyPlaced != null && currentlyPlaced != this && !_isPlaced)
            {
                currentlyPlaced.ReturnToHand();
            }

            // If this tile isn't already placed, save original position
            if (!_isPlaced)
            {
                _originalPosition = transform.position;
                _originalScale = transform.localScale;
                _originalRotation = transform.localRotation;
                _originalParent = transform.parent;
                _originalLayer = gameObject.layer;

                // Unparent so it moves in world space
                transform.SetParent(null);

                // Switch to Board layer so Main Camera renders it during drag
                SetLayerRecursively(gameObject, LayerMask.NameToLayer("Board"));

                // Select this letter
                GameManager.Instance.SelectLetter(Letter);
                Controller.SetSelectedIndex(Index);
            }
            else
            {
                // Already placed - just switch layer for dragging
                SetLayerRecursively(gameObject, LayerMask.NameToLayer("Board"));
            }

            _isDragging = true;
            InputStateManager.Instance.IsTileDragging = true;

            // Capture which finger started this drag
            _dragFingerId = -1;  // -1 means mouse
            if (Input.touchCount > 0)
            {
                for (int i = 0; i < Input.touchCount; i++)
                {
                    Touch t = Input.GetTouch(i);
                    if (t.phase == TouchPhase.Began)
                    {
                        _dragFingerId = t.fingerId;
                        break;
                    }
                }
            }

            // Set scale and rotation for board visibility
            if (_isQuadPrefab)
            {
                // Quad prefab: scale to board tile size, rotate to face up
                float boardTileSize = BoardRenderer.Instance != null
                    ? BoardRenderer.Instance.hexSize * BoardRenderer.Instance.glyphlingSize
                    : 1.62f;
                transform.localScale = new Vector3(boardTileSize, boardTileSize, boardTileSize);
                transform.rotation = Quaternion.Euler(90f, 0f, 0f);  // Quad faces up
            }
            else
            {
                // Cylinder fallback
                float boardTileSize = BoardRenderer.Instance != null
                    ? BoardRenderer.Instance.hexSize * BoardRenderer.Instance.glyphlingSize
                    : 1.62f;
                transform.localScale = new Vector3(boardTileSize, 0.05f, boardTileSize);
                transform.rotation = Quaternion.Euler(0f, 0f, 0f);

                // Fix the letter text to face up
                var letterText = transform.Find("Letter");
                if (letterText != null)
                {
                    letterText.rotation = Quaternion.Euler(90f, 0f, 0f);
                }
            }

            // Ensure material is preserved during drag (re-apply runeblossom texture)
            // Sometimes material can be lost during layer/transform changes
            if (_renderer != null && SpriteLoader.Instance != null)
            {
                var owner = GameManager.Instance?.GameState?.CurrentPlayer ?? Player.Yellow;
                Material mat = SpriteLoader.Instance.GetRuneblossomMaterial(Letter, owner);
                if (mat != null)
                {
                    _renderer.material = mat;
                }
            }

            Debug.Log($"Started dragging letter {Letter}");
        }

        private void Update()
        {
            if (!_isDragging) return;

            // Get position from the specific finger that started the drag
            Vector3 screenPos = Input.mousePosition;
            bool fingerReleased = false;

            if (_dragFingerId >= 0)
            {
                // Touch input - find our specific finger
                bool foundFinger = false;
                for (int i = 0; i < Input.touchCount; i++)
                {
                    Touch t = Input.GetTouch(i);
                    if (t.fingerId == _dragFingerId)
                    {
                        foundFinger = true;
                        screenPos = t.position;

                        if (t.phase == TouchPhase.Ended || t.phase == TouchPhase.Canceled)
                        {
                            fingerReleased = true;
                        }
                        break;
                    }
                }

                if (!foundFinger)
                {
                    // Finger no longer exists - must have been released
                    fingerReleased = true;
                }
                else if (!fingerReleased)
                {
                    // Move tile to follow this specific finger
                    Ray ray = _mainCamera.ScreenPointToRay(screenPos);
                    float distance = ray.origin.y / -ray.direction.y;
                    Vector3 mouseWorldPos = ray.origin + ray.direction * distance;

                    // Apply vertical offset so dragged object is visible above finger
                    float offset = GameSettings.GetDragOffsetWorld();
                    transform.position = new Vector3(
                        mouseWorldPos.x,
                        0.5f,
                        mouseWorldPos.z + offset
                    );
                    UpdateHoverHighlight(mouseWorldPos + new Vector3(0, 0, offset));  // Use object position
                }
            }
            else
            {
                // Mouse input
                Vector3 mouseWorldPos = InputUtility.GetMouseWorldPosition(_mainCamera);

                // Apply vertical offset so dragged object is visible above finger
                float offset = GameSettings.GetDragOffsetWorld();
                transform.position = new Vector3(
                    mouseWorldPos.x,
                    0.5f,
                    mouseWorldPos.z + offset
                );
                UpdateHoverHighlight(mouseWorldPos + new Vector3(0, 0, offset));  // Use object position

                if (Input.GetMouseButtonUp(0))
                {
                    fingerReleased = true;
                }
            }

            if (fingerReleased)
            {
                EndDrag();
            }
        }

        private void UpdateHoverHighlight(Vector3 mouseWorldPos)
        {
            if (BoardRenderer.Instance == null) return;

            // Check which hex we're hovering over
            HexCoord? newHoveredHex = BoardRenderer.Instance.WorldToHex(mouseWorldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Show highlight if over a valid cast position
                if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
                {
                    BoardRenderer.Instance.SetHoverHighlight(_hoveredHex.Value);
                }
                else
                {
                    BoardRenderer.Instance.ClearHoverHighlight();
                }
            }
        }

        private void EndDrag()
        {
            _isDragging = false;
            InputStateManager.Instance.IsTileDragging = false;
            BoardRenderer.Instance?.ClearHoverHighlight();

            // Check if dropped on valid hex
            if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
            {
                Debug.Log($"[HandTileDragHandler] EndDrag: Valid drop at {_hoveredHex.Value}, passing '{gameObject.name}' to ShowGhostTile");

                // Remove this object from HandController's tracking BEFORE we transfer it to board
                Controller.UntrackTileObject(gameObject);

                // Get current player for the tile owner
                var owner = GameManager.Instance.GameState.CurrentPlayer;

                // Pass this object to BoardRenderer as the ghost tile (same object, no destroy/recreate)
                BoardRenderer.Instance.ShowGhostTile(_hoveredHex.Value, Letter, owner, gameObject);

                // Set cast position in GameManager
                GameManager.Instance.SelectCastPosition(_hoveredHex.Value);

                // Mark as placed
                _isPlaced = true;
                InputStateManager.Instance.CurrentlyPlacedTile = this;

                // Show confirm button
                Controller.ShowConfirmButton();

                Debug.Log($"Dropped letter {Letter} on {_hoveredHex.Value}");
            }
            else
            {
                // Invalid drop - return to hand
                ReturnToHand();

                Debug.Log("Invalid drop - returning letter to hand");
            }

            _hoveredHex = null;
        }

        public void ReturnToHand()
        {
            // If we were placed on board, BoardRenderer has ownership - get it back
            if (_isPlaced && BoardRenderer.Instance != null)
            {
                // HideGhostTile returns the external object so we can reclaim it
                var ghostObj = BoardRenderer.Instance.HideGhostTile();
                if (ghostObj != null && ghostObj == gameObject)
                {
                    Debug.Log($"[HandTileDragHandler] ReturnToHand: Reclaimed tile from BoardRenderer");
                }
            }

            transform.SetParent(_originalParent);
            transform.position = _originalPosition;
            transform.localScale = _originalScale;
            transform.localRotation = _originalRotation;

            // Restore to UI3D layer
            SetLayerRecursively(gameObject, LayerMask.NameToLayer("UI3D"));

            // Restore solid appearance
            SetGhostAppearance(false);

            _isPlaced = false;
            _isDragging = false;

            if (InputStateManager.Instance != null && InputStateManager.Instance.CurrentlyPlacedTile == this)
            {
                InputStateManager.Instance.CurrentlyPlacedTile = null;
            }

            // Re-track this tile so RefreshHand() will properly destroy it
            // (we untracked it when placing on board, now we need to track again)
            Controller.RetrackTileObject(gameObject);

            GameManager.Instance.ClearPendingLetter();
            GameManager.Instance.ClearPendingCastPosition();
            Controller.ClearSelectedIndex();
            Controller.HideConfirmButton();
        }

        /// <summary>
        /// Called when the move is confirmed.
        /// The tile is already owned by BoardRenderer (via ShowGhostTile), so we just clear state.
        /// BoardRenderer.RefreshTiles will call ConfirmGhostTile to finalize it.
        /// </summary>
        public void OnMoveConfirmed()
        {
            if (_isPlaced)
            {
                // Clear placed state - BoardRenderer now owns this object
                _isPlaced = false;

                if (InputStateManager.Instance != null && InputStateManager.Instance.CurrentlyPlacedTile == this)
                {
                    InputStateManager.Instance.CurrentlyPlacedTile = null;
                }

                Debug.Log($"[HandTileDragHandler] OnMoveConfirmed: Tile '{Letter}' confirmed, BoardRenderer now owns it");
            }
        }

        /// <summary>
        /// Resets the tile after turn ends.
        /// Note: If the tile was confirmed, this handler is destroyed by BoardRenderer.ConfirmGhostTile
        /// and this method won't be called. This is only for tiles that were NOT confirmed.
        /// </summary>
        public void ResetAfterTurn()
        {
            // If this object is inactive, it was hidden by old code - shouldn't happen anymore
            if (!gameObject.activeSelf)
            {
                gameObject.SetActive(true);
            }

            // If we're still placed (not confirmed), return to hand
            if (_isPlaced)
            {
                ReturnToHand();
            }
            else
            {
                // Just ensure we're in correct state
                transform.SetParent(_originalParent);
                transform.position = _originalPosition;
                transform.localScale = _originalScale;
                transform.localRotation = _originalRotation;

                // Restore to UI3D layer
                SetLayerRecursively(gameObject, LayerMask.NameToLayer("UI3D"));

                SetGhostAppearance(false);
            }

            _isPlaced = false;

            if (InputStateManager.Instance != null && InputStateManager.Instance.CurrentlyPlacedTile == this)
            {
                InputStateManager.Instance.CurrentlyPlacedTile = null;
            }
        }

        private void SetGhostAppearance(bool isGhost)
        {
            if (_renderer == null) return;

            if (isGhost)
            {
                // For ghost: make semi-transparent
                Material mat = _renderer.material;
                Color color = mat.color;
                color.a = 0.5f;

                // Set rendering mode to transparent
                mat.SetOverrideTag("RenderType", "Transparent");
                mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                mat.SetInt("_ZWrite", 0);
                mat.DisableKeyword("_ALPHATEST_ON");
                mat.EnableKeyword("_ALPHABLEND_ON");
                mat.renderQueue = 3000;
                mat.color = color;
            }
            else
            {
                // Restore original material
                if (_originalMaterial != null)
                {
                    _renderer.material = _originalMaterial;
                }
            }
        }

        /// <summary>
        /// Sets layer for object and all children.
        /// </summary>
        private void SetLayerRecursively(GameObject obj, int layer)
        {
            obj.layer = layer;
            foreach (Transform child in obj.transform)
            {
                SetLayerRecursively(child.gameObject, layer);
            }
        }

        /// <summary>
        /// Static method to return the currently placed tile to hand.
        /// </summary>
        public static void ReturnCurrentlyPlacedTile()
        {
            if (InputStateManager.Instance != null && InputStateManager.Instance.CurrentlyPlacedTile != null)
            {
                InputStateManager.Instance.CurrentlyPlacedTile.ReturnToHand();
            }
        }
    }
}