using UnityEngine;
using Glyphtender.Core;
using System.Collections;
using System.Collections.Generic;
using UnityEngine.Rendering;

namespace Glyphtender.Unity
{
    public enum DockPosition
    {
        Bottom,
        Left,
        Right
    }

    /// <summary>
    /// Configuration for a specific dock position and orientation.
    /// </summary>
    public struct DockConfig
    {
        public Vector3 handUpPosition;
        public Vector3 handDownPosition;
        public Quaternion handRotation;
        public float tileSize;
        public float tileSpacing;
        public bool isVerticalLayout;
    }

    /// <summary>
    /// Manages the player's hand of tiles in 3D space.
    /// Attached to UI camera so it stays fixed during board zoom/pan.
    /// </summary>
    public class HandController : MonoBehaviour
    {
        public static HandController Instance { get; private set; }

        [Header("Camera")]
        public Camera uiCamera;

        [Header("Dock Settings")]
        public DockPosition currentDock = DockPosition.Bottom;

        [Header("Layout")]
        [Tooltip("Distance between tile centers")]
        public float tileSpacing = 1.3f;

        [Tooltip("Size of each tile (when equal to tileSpacing, they touch)")]
        public float tileSize = 1.25f;

        [Tooltip("Max tiles the hand can hold (for width calculation)")]
        public int maxHandSize = 8;

        [Header("Animation")]
        public float toggleDuration = 0.2f;

        [Header("Hand Scaling")]
        [Tooltip("User preference multiplier (menu slider)")]
        public float userHandScale = 1f;

        [Tooltip("Scale of hand when not ready to place a letter")]
        public float handInactiveScale = 1.0f;
        public float handScaleDuration = 0.15f;

        [Header("Materials")]
        public Material yellowTileMaterial;
        public Material blueTileMaterial;
        public Material selectedMaterial;

        // Public state for GameUIController
        public bool IsInCycleMode => _isInCycleMode;

        // Dock configurations
        private DockConfig _currentConfig;

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

        // Anchor
        private Transform _handAnchor;

        // Cycle mode
        private bool _isInCycleMode;
        private HashSet<int> _selectedForDiscard = new HashSet<int>();
        private GameObject _cyclePromptText;

        // Hand scaling
        private bool _handIsActive = false;
        private Coroutine _handScaleCoroutine;
        private float _responsiveScale = 1f;

        private float _handDistance = 6f;

        private void Awake()
        {
            if (Instance == null)
            {
                Instance = this;
            }
            else
            {
                Destroy(gameObject);
            }
        }

        private void Start()
        {
            // Find UI camera if not set
            if (uiCamera == null)
            {
                uiCamera = GetComponentInParent<Camera>();

                if (uiCamera == null)
                {
                    var uiCamObj = GameObject.Find("UICamera");
                    if (uiCamObj != null)
                    {
                        uiCamera = uiCamObj.GetComponent<Camera>();
                    }
                }

                if (uiCamera == null)
                {
                    Debug.LogError("HandController: No UI camera found!");
                    return;
                }
            }

            // Create hand anchor
            _handAnchor = new GameObject("HandAnchor").transform;
            _handAnchor.SetParent(uiCamera.transform);

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshHand;
                GameManager.Instance.OnSelectionChanged += OnSelectionChanged;
                GameManager.Instance.OnGameEnded += OnGameEnded;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            // Subscribe to UIScaler layout changes
            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged += OnLayoutChanged;
            }

            CreateCyclePrompt();

            ApplyDockConfig();

            // Initialize responsive scaling
            _handIsActive = false;
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);

            RefreshHand();
        }

        private void Update()
        {
            if (uiCamera == null) return;

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

            // Debug: Press D to cycle dock positions
            if (Input.GetKeyDown(KeyCode.D))
            {
                switch (currentDock)
                {
                    case DockPosition.Bottom:
                        SetDockPosition(DockPosition.Left);
                        break;
                    case DockPosition.Left:
                        SetDockPosition(DockPosition.Right);
                        break;
                    case DockPosition.Right:
                        SetDockPosition(DockPosition.Bottom);
                        break;
                }
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshHand;
                GameManager.Instance.OnSelectionChanged -= OnSelectionChanged;
                GameManager.Instance.OnGameEnded -= OnGameEnded;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }

            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged -= OnLayoutChanged;
            }
        }

        /// <summary>
        /// Called by UIScaler when screen layout changes.
        /// </summary>
        private void OnLayoutChanged()
        {
            ApplyDockConfig();
            RefreshResponsiveScale();
        }

        #region Dock Positioning

        private void ApplyDockConfig()
        {
            _currentConfig = GetDockConfig(currentDock);

            _handAnchor.localPosition = _isUp ? _currentConfig.handUpPosition : _currentConfig.handDownPosition;
            _handAnchor.localRotation = _currentConfig.handRotation;
        }

        public void SetDockPosition(DockPosition newDock)
        {
            currentDock = newDock;
            ApplyDockConfig();
            RefreshHand();
        }

        private DockConfig GetDockConfig(DockPosition dock)
        {
            DockConfig config = new DockConfig();

            float halfHeight = UIScaler.Instance != null ? UIScaler.Instance.HalfHeight : 5f;
            float halfWidth = UIScaler.Instance != null ? UIScaler.Instance.HalfWidth : 8f;

            // Note: Hand anchor is rotated 180° on X, so negative Y appears at bottom
            switch (dock)
            {
                case DockPosition.Bottom:
                    float bottomY = -(halfHeight - 1f);  // Near bottom edge
                    config.handUpPosition = new Vector3(0f, bottomY, _handDistance);
                    config.handDownPosition = new Vector3(0f, -(halfHeight + 2f), _handDistance);
                    config.handRotation = Quaternion.Euler(180f, 0f, 0f);
                    config.isVerticalLayout = false;
                    break;

                case DockPosition.Left:
                    config.handUpPosition = new Vector3(-halfWidth + 1f, 0f, _handDistance);
                    config.handDownPosition = new Vector3(-halfWidth - 2f, 0f, _handDistance);
                    config.handRotation = Quaternion.Euler(180f, 0f, -90f);
                    config.isVerticalLayout = true;
                    break;

                case DockPosition.Right:
                    config.handUpPosition = new Vector3(halfWidth - 1f, 0f, _handDistance);
                    config.handDownPosition = new Vector3(halfWidth + 2f, 0f, _handDistance);
                    config.handRotation = Quaternion.Euler(180f, 0f, 90f);
                    config.isVerticalLayout = true;
                    break;
            }

            return config;
        }

        #endregion

        #region Cycle Prompt

        private void CreateCyclePrompt()
        {
            GameObject textObj = new GameObject("CyclePrompt");
            textObj.transform.SetParent(_handAnchor);
            textObj.transform.localPosition = new Vector3(0f, -1f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(180f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.05f, 0.05f, 0.05f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = "You may refresh any number of tiles.";
            textMesh.fontSize = 100;
            textMesh.characterSize = 0.5f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            _cyclePromptText = textObj;
            _cyclePromptText.SetActive(false);
        }

        #endregion

        #region Hand Visibility

        /// <summary>
        /// Hides hand tiles when menu is open.
        /// </summary>
        public void HideHand()
        {
            if (_handAnchor != null)
            {
                _handAnchor.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// Shows hand tiles when menu closes.
        /// </summary>
        public void ShowHand()
        {
            if (_handAnchor != null)
            {
                _handAnchor.gameObject.SetActive(true);
            }
        }

        /// <summary>
        /// Toggle hand visibility (up/down).
        /// </summary>
        public void ToggleHand()
        {
            _isUp = !_isUp;
            _lerpStart = _handAnchor.localPosition;
            _lerpTarget = _isUp ? _currentConfig.handUpPosition : _currentConfig.handDownPosition;
            _lerpTime = 0f;
            _isLerping = true;
        }

        #endregion

        #region Responsive Scaling

        /// <summary>
        /// Calculates the responsive scale factor based on screen width and aspect ratio.
        /// Uses UIScaler for consistent responsive calculations.
        /// </summary>
        private float CalculateResponsiveScale()
        {
            if (UIScaler.Instance == null) return 1f;

            float naturalWidth = (maxHandSize - 1) * tileSpacing + tileSize;
            return UIScaler.Instance.GetWidthFillScale(naturalWidth);
        }

        /// <summary>
        /// Updates the hand anchor scale combining responsive, user, and active scales.
        /// </summary>
        private void UpdateHandScale(bool animate = false)
        {
            if (_handAnchor == null) return;

            float activeScale = _handIsActive ? 1f : handInactiveScale;
            float targetScale = _responsiveScale * userHandScale * activeScale;

            if (animate)
            {
                if (_handScaleCoroutine != null)
                {
                    StopCoroutine(_handScaleCoroutine);
                }
                _handScaleCoroutine = StartCoroutine(AnimateHandScale(targetScale));
            }
            else
            {
                _handAnchor.localScale = Vector3.one * targetScale;
            }
        }

        /// <summary>
        /// Recalculates responsive scale and updates hand.
        /// </summary>
        private void RefreshResponsiveScale()
        {
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);
        }

        private void SetHandActive(bool active)
        {
            _handIsActive = active;
            Debug.Log($"[HandController] SetHandActive({active})");
            UpdateHandScale(animate: true);
        }

        private IEnumerator AnimateHandScale(float targetScale)
        {
            if (_handAnchor == null) yield break;

            Vector3 startScale = _handAnchor.localScale;
            Vector3 endScale = Vector3.one * targetScale;
            float elapsed = 0f;

            while (elapsed < handScaleDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / handScaleDuration;
                t = 1f - Mathf.Pow(1f - t, 3f);
                _handAnchor.localScale = Vector3.Lerp(startScale, endScale, t);
                yield return null;
            }

            _handAnchor.localScale = endScale;
            _handScaleCoroutine = null;
        }

        #endregion

        #region Hand Tiles

        /// <summary>
        /// Rebuild hand tiles from current player's hand.
        /// </summary>
        public void RefreshHand()
        {
            if (GameManager.Instance?.GameState == null) return;

            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];

            foreach (var obj in _handTileObjects)
            {
                Destroy(obj);
            }
            _handTileObjects.Clear();
            _currentHand.Clear();
            _selectedIndex = -1;

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
            GameObject tile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            tile.transform.SetParent(_handAnchor);
            tile.transform.localPosition = localPos;
            tile.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);
            tile.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;
            tile.layer = LayerMask.NameToLayer("UI3D");

            var state = GameManager.Instance.GameState;
            Material mat = state.CurrentPlayer == Player.Yellow ? yellowTileMaterial : blueTileMaterial;
            if (mat != null)
            {
                tile.GetComponent<Renderer>().material = mat;
            }

            tile.name = $"HandTile_{letter}_{index}";

            var clickHandler = tile.AddComponent<HandTileClickHandler>();
            clickHandler.Controller = this;
            clickHandler.Index = index;
            clickHandler.Letter = letter;

            var dragHandler = tile.AddComponent<HandTileDragHandler>();
            dragHandler.Controller = this;
            dragHandler.Index = index;
            dragHandler.Letter = letter;

            CreateLetterText(tile, letter);

            return tile;
        }

        private void CreateLetterText(GameObject tile, char letter)
        {
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(tile.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.15f, 0.15f, 0.15f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = letter.ToString();
            textMesh.fontSize = 64;
            textMesh.characterSize = 0.5f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;
        }

        public void OnTileClicked(int index, char letter)
        {
            if (_isInCycleMode)
            {
                ToggleTileForDiscard(index);
                return;
            }

            if (GameManager.Instance.CurrentTurnState != GameTurnState.MovePending &&
                GameManager.Instance.CurrentTurnState != GameTurnState.ReadyToConfirm)
            {
                return;
            }

            _selectedIndex = index;
            UpdateTileHighlights();
            GameManager.Instance.SelectLetter(letter);
        }

        private void UpdateTileHighlights()
        {
            var state = GameManager.Instance.GameState;
            for (int i = 0; i < _handTileObjects.Count; i++)
            {
                var tile = _handTileObjects[i];
                var renderer = tile.GetComponent<Renderer>();

                if (i == _selectedIndex && selectedMaterial != null)
                {
                    renderer.material = selectedMaterial;
                }
                else
                {
                    Material mat = state.CurrentPlayer == Player.Yellow ? yellowTileMaterial : blueTileMaterial;
                    if (mat != null)
                    {
                        renderer.material = mat;
                    }
                }
            }
        }

        /// <summary>
        /// Sets the selected tile index (called by drag handler).
        /// </summary>
        public void SetSelectedIndex(int index)
        {
            _selectedIndex = index;
            UpdateTileHighlights();
        }

        /// <summary>
        /// Clears the selected tile index.
        /// </summary>
        public void ClearSelectedIndex()
        {
            _selectedIndex = -1;
            UpdateTileHighlights();
        }

        /// <summary>
        /// Wrapper to show confirm button via GameUIController.
        /// </summary>
        public void ShowConfirmButton()
        {
            GameUIController.Instance?.ShowConfirmButton();
        }

        /// <summary>
        /// Wrapper to hide confirm button via GameUIController.
        /// </summary>
        public void HideConfirmButton()
        {
            GameUIController.Instance?.HideConfirmButton();
        }

        #endregion

        #region Event Handlers

        private void OnSelectionChanged()
        {
            if (GameManager.Instance.IsInCycleMode && !_isInCycleMode)
            {
                EnterCycleMode();
                return;
            }

            if (_isInCycleMode)
            {
                return;
            }

            // Check if hand should be active (ready to place a letter)
            var turnState = GameManager.Instance.CurrentTurnState;
            bool shouldBeActive = (turnState == GameTurnState.MovePending);

            if (shouldBeActive && !_handIsActive)
            {
                SetHandActive(true);
            }
            else if (!shouldBeActive && _handIsActive)
            {
                SetHandActive(false);
            }

            if (GameManager.Instance.SelectedGlyphling == null)
            {
                _selectedIndex = -1;
                UpdateTileHighlights();
            }
        }

        private void OnGameEnded(Player? winner)
        {
            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(false);
            }
        }

        private void OnGameRestarted()
        {
            _isInCycleMode = false;
            _selectedForDiscard.Clear();
            _cyclePromptText.SetActive(false);

            // Reset hand to inactive state
            _handIsActive = false;
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);

            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(true);
            }

            RefreshHand();
        }

        #endregion

        #region Cycle Mode

        private void EnterCycleMode()
        {
            _isInCycleMode = true;
            _selectedForDiscard.Clear();

            _cyclePromptText.SetActive(true);

            // Tell GameUIController to show confirm button
            if (GameUIController.Instance != null)
            {
                GameUIController.Instance.ShowConfirmButton();
                GameUIController.Instance.HideCancelButton();
            }

            // Hand is active in cycle mode
            SetHandActive(true);

            Debug.Log("Entered cycle mode - select tiles to discard");
        }

        private void ToggleTileForDiscard(int index)
        {
            if (_selectedForDiscard.Contains(index))
            {
                _selectedForDiscard.Remove(index);
                var tile = _handTileObjects[index];
                tile.transform.localPosition += new Vector3(0f, 0.3f, 0f);
                tile.transform.localScale = new Vector3(tileSize, 0.05f, tileSize);
            }
            else
            {
                _selectedForDiscard.Add(index);
                var tile = _handTileObjects[index];
                tile.transform.localPosition -= new Vector3(0f, 0.3f, 0f);
                tile.transform.localScale = new Vector3(tileSize * 1.2f, 0.05f, tileSize * 1.2f);
            }

            Debug.Log($"Tiles selected for discard: {_selectedForDiscard.Count}");
        }

        /// <summary>
        /// Called by GameUIController when confirm is clicked during cycle mode.
        /// </summary>
        public void ConfirmCycleDiscard()
        {
            var state = GameManager.Instance.GameState;
            var hand = state.Hands[state.CurrentPlayer];
            var toDiscard = new List<char>();

            foreach (int index in _selectedForDiscard)
            {
                toDiscard.Add(_currentHand[index]);
            }

            foreach (char letter in toDiscard)
            {
                hand.Remove(letter);
            }

            while (hand.Count < GameRules.HandSize && state.TileBag.Count > 0)
            {
                GameRules.DrawTile(state, state.CurrentPlayer);
            }

            Debug.Log($"Discarded {toDiscard.Count} tiles, drew back up to {hand.Count}");

            ExitCycleMode();
            GameManager.Instance.EndCycleMode();
        }

        private void ExitCycleMode()
        {
            _isInCycleMode = false;
            _selectedForDiscard.Clear();
            _cyclePromptText.SetActive(false);

            if (GameUIController.Instance != null)
            {
                GameUIController.Instance.HideConfirmButton();
            }

            // Hand returns to inactive state
            SetHandActive(false);
        }

        #endregion
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
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            if (!GameManager.Instance.IsInCycleMode &&
                GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            Controller?.OnTileClicked(Index, Letter);
        }
    }
}