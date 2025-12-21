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
        private Color _originalColor;
        private Camera _mainCamera;
        private BoardRenderer _boardRenderer;
        private HexCoord? _hoveredHex;
        private Renderer _renderer;

        private static HandTileDragHandler _currentlyPlacedTile;

        private void Start()
        {
            _mainCamera = Camera.main;
            _boardRenderer = FindObjectOfType<BoardRenderer>();
            _renderer = GetComponent<Renderer>();
            if (_renderer != null)
            {
                _originalColor = _renderer.material.color;
            }
        }

        private void OnMouseDown()
        {
            // Only handle in drag mode
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Drag)
                return;

            // Only allow after glyphling has moved
            if (GameManager.Instance.PendingDestination == null)
            {
                Debug.Log("Move your glyphling first!");
                return;
            }

            // If another tile is already placed (and it's not this one), return it to hand first
            if (_currentlyPlacedTile != null && _currentlyPlacedTile != this && !_isPlaced)
            {
                _currentlyPlacedTile.ReturnToHand();
            }

            // If this tile isn't already placed, save original position
            if (!_isPlaced)
            {
                _originalPosition = transform.position;
                _originalScale = transform.localScale;
                _originalRotation = transform.localRotation;
                _originalParent = transform.parent;

                // Unparent so it moves in world space
                transform.SetParent(null);

                // Select this letter
                GameManager.Instance.SelectLetter(Letter);
                Controller.SetSelectedIndex(Index);
            }

            _isDragging = true;

            // Set scale for board visibility
            transform.localScale = new Vector3(1.5f, 0.05f, 1.5f);
            transform.localRotation = Quaternion.Euler(0f, 0f, 0f);

            // Make semi-transparent while dragging
            SetGhostAppearance(true);

            Debug.Log($"Started dragging letter {Letter}");
        }

        private void Update()
        {
            if (!_isDragging) return;

            // Move tile to follow cursor
            Vector3 mouseWorldPos = GetMouseWorldPosition();
            transform.position = new Vector3(mouseWorldPos.x, 0.5f, mouseWorldPos.z);

            // Check which hex we're hovering over
            HexCoord? newHoveredHex = _boardRenderer.WorldToHex(mouseWorldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Show highlight if over a valid cast position
                if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
                {
                    _boardRenderer.SetHoverHighlight(_hoveredHex.Value);
                }
                else
                {
                    _boardRenderer.ClearHoverHighlight();
                }
            }

            // Check for mouse release
            if (Input.GetMouseButtonUp(0))
            {
                EndDrag();
            }
        }

        private void EndDrag()
        {
            _isDragging = false;
            _boardRenderer.ClearHoverHighlight();

            // Check if dropped on valid hex
            if (_hoveredHex != null && GameManager.Instance.ValidCasts.Contains(_hoveredHex.Value))
            {
                // Valid drop - set cast position and keep tile on board as ghost
                GameManager.Instance.SelectCastPosition(_hoveredHex.Value);

                // Position tile on the board
                Vector3 boardPos = _boardRenderer.HexToWorld(_hoveredHex.Value) + Vector3.up * 0.2f;
                transform.position = boardPos;
                transform.localScale = new Vector3(1.5f, 0.05f, 1.5f);
                transform.localRotation = Quaternion.Euler(0f, 0f, 0f);

                // Keep ghost appearance
                SetGhostAppearance(true);

                // Mark as placed
                _isPlaced = true;
                _currentlyPlacedTile = this;

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

            // Restore solid appearance
            SetGhostAppearance(false);

            _isPlaced = false;
            _isDragging = false;

            if (_currentlyPlacedTile == this)
            {
                _currentlyPlacedTile = null;
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
                _currentlyPlacedTile = null;
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

            SetGhostAppearance(false);
            _isPlaced = false;

            if (_currentlyPlacedTile == this)
            {
                _currentlyPlacedTile = null;
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

        private Vector3 GetMouseWorldPosition()
        {
            Ray ray = _mainCamera.ScreenPointToRay(Input.mousePosition);
            Plane boardPlane = new Plane(Vector3.up, Vector3.zero);

            if (boardPlane.Raycast(ray, out float distance))
            {
                return ray.GetPoint(distance);
            }

            return transform.position;
        }

        /// <summary>
        /// Static method to return the currently placed tile to hand.
        /// </summary>
        public static void ReturnCurrentlyPlacedTile()
        {
            if (_currentlyPlacedTile != null)
            {
                _currentlyPlacedTile.ReturnToHand();
            }
        }
    }
}