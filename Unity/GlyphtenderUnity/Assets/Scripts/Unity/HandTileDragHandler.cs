using UnityEngine;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Handles drag and drop input for hand tiles.
    /// Only active when GameManager.CurrentInputMode is Drag.
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
        private Color _originalColor;
        private Camera _mainCamera;
        private HexCoord? _hoveredHex;
        private Renderer _renderer;
        private int _dragFingerId = -1;  // Track which finger started the drag

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
                _originalColor = _renderer.material.color;
            }
            _originalLayer = gameObject.layer;

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

            // Set scale for board visibility
            transform.localScale = new Vector3(1.5f, 0.05f, 1.5f);

            // Set tile flat and facing up
            transform.rotation = Quaternion.Euler(0f, 0f, 0f);

            // Fix the letter text to face up
            var letterText = transform.Find("Letter");
            if (letterText != null)
            {
                letterText.rotation = Quaternion.Euler(90f, 0f, 0f);
            }

            // Make semi-transparent while dragging
            SetGhostAppearance(true);

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
                // Valid drop - set cast position and keep tile on board as ghost
                GameManager.Instance.SelectCastPosition(_hoveredHex.Value);

                // Position tile on the board
                Vector3 boardPos = BoardRenderer.Instance.HexToWorld(_hoveredHex.Value) + Vector3.up * 0.2f;
                transform.position = boardPos;
                transform.localScale = new Vector3(1.5f, 0.05f, 1.5f);
                transform.rotation = Quaternion.Euler(0f, 0f, 0f);

                // Keep on Board layer so it's visible with the board
                // Keep ghost appearance
                SetGhostAppearance(true);

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

            GameManager.Instance.ClearPendingLetter();
            GameManager.Instance.ClearPendingCastPosition();
            Controller.ClearSelectedIndex();
            Controller.HideConfirmButton();
        }

        /// <summary>
        /// Called when the move is confirmed - hide this ghost tile.
        /// </summary>
        public void OnMoveConfirmed()
        {
            if (_isPlaced)
            {
                // Hide this tile - the real tile will be created by BoardRenderer
                gameObject.SetActive(false);
                _isPlaced = false;

                if (InputStateManager.Instance != null && InputStateManager.Instance.CurrentlyPlacedTile == this)
                {
                    InputStateManager.Instance.CurrentlyPlacedTile = null;
                }
            }
        }

        /// <summary>
        /// Resets the tile after turn ends.
        /// </summary>
        public void ResetAfterTurn()
        {
            if (!gameObject.activeSelf)
            {
                gameObject.SetActive(true);
            }

            transform.SetParent(_originalParent);
            transform.position = _originalPosition;
            transform.localScale = _originalScale;
            transform.localRotation = _originalRotation;

            // Restore to UI3D layer
            SetLayerRecursively(gameObject, LayerMask.NameToLayer("UI3D"));

            SetGhostAppearance(false);
            _isPlaced = false;

            if (InputStateManager.Instance != null && InputStateManager.Instance.CurrentlyPlacedTile == this)
            {
                InputStateManager.Instance.CurrentlyPlacedTile = null;
            }
        }

        private void SetGhostAppearance(bool isGhost)
        {
            if (_renderer == null) return;

            // Create a new material instance if needed
            if (_originalColor == default)
            {
                _originalColor = _renderer.material.color;
            }

            Color color = _originalColor;
            color.a = isGhost ? 0.5f : 1f;

            // Set rendering mode to transparent
            Material mat = _renderer.material;
            if (isGhost)
            {
                mat.SetOverrideTag("RenderType", "Transparent");
                mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
                mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
                mat.SetInt("_ZWrite", 0);
                mat.EnableKeyword("_ALPHABLEND_ON");
                mat.renderQueue = 3000;
            }
            else
            {
                mat.SetOverrideTag("RenderType", "Opaque");
                mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.One);
                mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.Zero);
                mat.SetInt("_ZWrite", 1);
                mat.DisableKeyword("_ALPHABLEND_ON");
                mat.renderQueue = -1;
            }

            mat.color = color;
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