using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Manages the player's hand of tiles in 3D space.
    /// Attached to camera so it follows the view.
    /// </summary>
    public class HandController : MonoBehaviour
    {
        [Header("Layout")]
        public float tileSpacing = 1.2f;
        public float tileSize = 0.8f;
 
        public Vector3 handUpPosition = new Vector3(0f, -3f, 6f);
        public Vector3 handDownPosition = new Vector3(0f, -4.5f, 6f);

        [Header("Animation")]
        public float toggleDuration = 0.2f;

        [Header("Materials")]
        public Material yellowTileMaterial;
        public Material blueTileMaterial;
        public Material selectedMaterial;

        [Header("Confirm Button")]
        public Material confirmMaterial;
        public float confirmButtonSize = 0.6f;
        public Vector3 confirmButtonOffset = new Vector3(5f, 0f, 0f);

        // State
        private bool _isUp = true;
        private float _lerpTime;
        private Vector3 _lerpStart;
        private Vector3 _lerpTarget;
        private bool _isLerping;

        // Hand tiles
        private List<GameObject> _handTileObjects = new List<GameObject>();
        private List<char> _currentHand = new List<char>();
        private int _selectedIndex = -1;

        // Reference to anchor point
        private Transform _handAnchor;

        // Confirm Button
        private GameObject _confirmButton;
        private bool _confirmVisible;

        private void Start()
        {
            // Create anchor as child of camera
            _handAnchor = new GameObject("HandAnchor").transform;
            _handAnchor.SetParent(Camera.main.transform);
            _handAnchor.localPosition = handUpPosition;
            _handAnchor.localRotation = Quaternion.Euler(180f, 0f, 0f);

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshHand;
                GameManager.Instance.OnSelectionChanged += OnSelectionChanged;
                RefreshHand();
            }

            CreateConfirmButton();
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshHand;
                GameManager.Instance.OnSelectionChanged -= OnSelectionChanged;
            }
        }

        private void Update()
        {
            // Handle toggle lerp
            if (_isLerping)
            {
                _lerpTime += Time.deltaTime;
                float t = Mathf.Clamp01(_lerpTime / toggleDuration);
                t = t * t * (3f - 2f * t); // Smooth step

                _handAnchor.localPosition = Vector3.Lerp(_lerpStart, _lerpTarget, t);

                if (t >= 1f)
                {
                    _isLerping = false;
                }
            }
        }

        /// <summary>
        /// Toggle hand visibility (up/down).
        /// </summary>
        public void ToggleHand()
        {
            _isUp = !_isUp;
            _lerpStart = _handAnchor.localPosition;
            _lerpTarget = _isUp ? handUpPosition : handDownPosition;
            _lerpTime = 0f;
            _isLerping = true;
        }

        private void CreateConfirmButton()
        {
            _confirmButton = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            _confirmButton.transform.SetParent(_handAnchor);
            _confirmButton.transform.localPosition = confirmButtonOffset;
            _confirmButton.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            _confirmButton.transform.localScale = new Vector3(confirmButtonSize, 0.05f, confirmButtonSize);
            _confirmButton.name = "ConfirmButton";

            if (confirmMaterial != null)
            {
                _confirmButton.GetComponent<Renderer>().material = confirmMaterial;
            }

            // Add click handler
            var handler = _confirmButton.AddComponent<ConfirmButtonClickHandler>();
            handler.Controller = this;

            // Add text label
            GameObject textObj = new GameObject("Label");
            textObj.transform.SetParent(_confirmButton.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.15f, 0.15f, 0.15f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "OK";
            textMesh.fontSize = 32;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;

            _confirmButton.SetActive(false);
            _confirmVisible = false;
        }

        /// <summary>
        /// Rebuild hand tiles from current player's hand.
        /// </summary>
        public void RefreshHand()
        {
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];

            // Clear old tiles
            foreach (var obj in _handTileObjects)
            {
                Destroy(obj);
            }
            _handTileObjects.Clear();
            _currentHand.Clear();
            _selectedIndex = -1;

            // Create new tiles
            float totalWidth = (hand.Count - 1) * tileSpacing;
            float startX = -totalWidth / 2f;

            for (int i = 0; i < hand.Count; i++)
            {
                char letter = hand[i];
                _currentHand.Add(letter);

                Vector3 localPos = new Vector3(startX + i * tileSpacing, 0f, 0f);
                GameObject tileObj = CreateHandTile(letter, localPos, i);
                _handTileObjects.Add(tileObj);
            }
        }

        private GameObject CreateHandTile(char letter, Vector3 localPos, int index)
        {
            // Create cylinder as hex placeholder
            GameObject tile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tile.transform.SetParent(_handAnchor);
            tile.transform.localPosition = localPos;
            tile.transform.localRotation = Quaternion.Euler(90f, 0f, 0f); // Flat
            tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);

            // Set material based on current player
            var state = GameManager.Instance.GameState;
            Material mat = state.CurrentPlayer == Player.Yellow ? yellowTileMaterial : blueTileMaterial;
            if (mat != null)
            {
                tile.GetComponent<Renderer>().material = mat;
            }

            tile.name = $"HandTile_{letter}_{index}";

            // Add click handler
            var handler = tile.AddComponent<HandTileClickHandler>();
            handler.Controller = this;
            handler.Index = index;
            handler.Letter = letter;

            // Add 3D text for letter (placeholder)
            CreateLetterText(tile, letter);

            return tile;
        }

        private void CreateLetterText(GameObject tile, char letter)
        {
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(tile.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.5f, 0.5f, 0.5f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = letter.ToString();
            textMesh.fontSize = 32;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;
        }

        /// <summary>
        /// Called when a hand tile is clicked.
        /// </summary>
        public void OnTileClicked(int index, char letter)
        {
            // Only allow selection when we're in cast position selection phase
            if (GameManager.Instance.PendingCastPosition == null)
            {
                Debug.Log("Choose a cast position first!");
                return;
            }

            _selectedIndex = index;
            UpdateTileHighlights();

            Debug.Log($"Selected letter: {letter}");
            GameManager.Instance.SelectLetter(letter);
            ShowConfirmButton();
        }

        private void UpdateTileHighlights()
        {
            for (int i = 0; i < _handTileObjects.Count; i++)
            {
                var renderer = _handTileObjects[i].GetComponent<Renderer>();
                if (renderer == null) continue;

                if (i == _selectedIndex && selectedMaterial != null)
                {
                    renderer.material = selectedMaterial;
                }
                else
                {
                    var state = GameManager.Instance.GameState;
                    Material mat = state.CurrentPlayer == Player.Yellow ? yellowTileMaterial : blueTileMaterial;
                    if (mat != null)
                    {
                        renderer.material = mat;
                    }
                }
            }
        }

        private void OnSelectionChanged()
        {
            // If selection was cleared, reset highlights
            if (GameManager.Instance.SelectedGlyphling == null)
            {
                _selectedIndex = -1;
                UpdateTileHighlights();
                HideConfirmButton();
            }
        }

        public void ShowConfirmButton()
        {
            _confirmButton.SetActive(true);
            _confirmVisible = true;
        }

        public void HideConfirmButton()
        {
            _confirmButton.SetActive(false);
            _confirmVisible = false;
        }

        public void OnConfirmClicked()
        {
            if (GameManager.Instance.PendingLetter != null)
            {
                GameManager.Instance.ConfirmMove();
                HideConfirmButton();
            }
        }
    }

    /// <summary>
    /// Handles clicks on hand tiles.
    /// </summary>
    public class HandTileClickHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }
        public int Index { get; set; }
        public char Letter { get; set; }

        private void OnMouseDown()
        {
            Controller?.OnTileClicked(Index, Letter);
        }
    }

    /// <summary>
    /// Handles clicks on confirm button.
    /// </summary>
    public class ConfirmButtonClickHandler : MonoBehaviour
    {
        public HandController Controller { get; set; }

        private void OnMouseDown()
        {
            Controller?.OnConfirmClicked();
        }
    }
}