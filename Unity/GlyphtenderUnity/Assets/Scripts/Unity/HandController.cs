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
        [Header("Camera")]
        public Camera uiCamera;  // Reference to UI camera (set in inspector or auto-found)

        [Header("Dock Settings")]
        public DockPosition currentDock = DockPosition.Bottom;

        [Header("Layout")]
        [Tooltip("Distance between tile centers")]
        public float tileSpacing = 1.3f;

        [Tooltip("Size of each tile (when equal to tileSpacing, they touch)")]
        public float tileSize = 1.25f;

        [Tooltip("Max tiles the hand can hold (for width calculation)")]
        public int maxHandSize = 8;

        [Header("Responsive Width")]
        [Tooltip("Percent of screen width for hand in portrait")]
        public float portraitWidthPercent = 0.95f;

        [Tooltip("Percent of screen width for hand in landscape at reference aspect")]
        public float landscapeBasePercent = 0.45f;

        [Tooltip("Reference aspect ratio for landscape (phone = 2.2)")]
        public float referenceAspect = 2.2f;

        [Header("Animation")]
        public float toggleDuration = 0.2f;

        [Header("Hand Scaling")]
        [Tooltip("User preference multiplier (menu slider)")]
        public float userHandScale = 1f;

        [Tooltip("Scale of hand when not ready to place a letter")]
        public float handInactiveScale = 0.7f;
        public float handScaleDuration = 0.15f;

        [Header("Materials")]
        public Material yellowTileMaterial;
        public Material blueTileMaterial;
        public Material selectedMaterial;

        [Header("Buttons")]
        public Material confirmMaterial;
        public Material cancelMaterial;
        public float buttonSize = 0.75f;

        [Header("Menu Button (anchored to top-right corner)")]
        public float inputModeFromRight = 1.0f;   // Units from right edge
        public float inputModeFromTop = 1.0f;     // Units from top edge

        [Header("Confirm Button (anchored to bottom-right corner)")]
        public float confirmFromRight = 1.0f;     // Units from right edge
        public float confirmFromBottom = 1.75f;   // Units from bottom edge

        [Header("Cancel Button (anchored to bottom-right corner)")]
        public float cancelFromRight = 1.0f;      // Units from right edge
        public float cancelFromBottom = 3.0f;     // Units from bottom edge

        // Dock configurations
        private DockConfig _currentConfig;

        // State
        private float _lastAspect;
        private bool _lastIsPortrait;
        private bool _isUp = true;
        private float _lerpTime;
        private Vector3 _lerpStart;
        private Vector3 _lerpTarget;
        private bool _isLerping;

        // Hand tiles
        private List<GameObject> _handTileObjects = new List<GameObject>();
        private List<char> _currentHand = new List<char>();
        private int _selectedIndex = -1;

        // Anchors - separate for hand tiles vs UI elements
        private Transform _handAnchor;      // Moves/rotates with dock position
        private Transform _uiAnchor;        // Fixed, children position relative to screen edges

        // Confirm Button
        private GameObject _confirmButton;
        private bool _confirmVisible;

        // Cancel Button
        private GameObject _cancelButton;

        // Replay Button
        private GameObject _replayButton;

        // Input Mode Toggle Button
        private GameObject _inputModeButton;
        private TextMesh _inputModeText;

        // Cycle mode
        private bool _isInCycleMode;
        private HashSet<int> _selectedForDiscard = new HashSet<int>();
        private GameObject _cyclePromptText;

        // Hand scaling
        private bool _handIsActive = false;
        private Coroutine _handScaleCoroutine;
        private float _responsiveScale = 1f;

        private float _handDistance = 6f;

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

            // Create hand anchor (for tiles - moves with dock)
            _handAnchor = new GameObject("HandAnchor").transform;
            _handAnchor.SetParent(uiCamera.transform);

            // Create UI anchor (for buttons - fixed, children edge-anchor themselves)
            _uiAnchor = new GameObject("UIAnchor").transform;
            _uiAnchor.SetParent(uiCamera.transform);
            _uiAnchor.localPosition = new Vector3(0f, 0f, _handDistance);
            _uiAnchor.localRotation = Quaternion.Euler(180f, 0f, 0f);

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshHand;
                GameManager.Instance.OnSelectionChanged += OnSelectionChanged;
                GameManager.Instance.OnGameEnded += OnGameEnded;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            CreateConfirmButton();
            CreateCancelButton();
            CreateCyclePrompt();
            CreateReplayButton();
            CreateMenuButton();

            ApplyDockConfig();
            PositionUIElements();

            // Initialize responsive scaling
            _handIsActive = false;
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);
            Debug.Log($"[HandController] Initial responsive scale: {_responsiveScale}");

            RefreshHand();
        }

        private void Update()
        {
            if (uiCamera == null) return;

            // Check for aspect ratio changes
            bool isPortrait = Screen.height > Screen.width;
            if (Mathf.Abs(uiCamera.aspect - _lastAspect) > 0.01f || isPortrait != _lastIsPortrait)
            {
                _lastAspect = uiCamera.aspect;
                _lastIsPortrait = isPortrait;
                ApplyDockConfig();
                PositionUIElements();
                RefreshResponsiveScale();
            }

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

        /// <summary>
        /// Positions UI elements (buttons) relative to screen corners.
        /// Each button is anchored to a corner and offset inward from there.
        /// </summary>
        private void PositionUIElements()
        {
            if (uiCamera == null) return;

            // Screen bounds (half-sizes from center)
            float halfHeight = uiCamera.orthographicSize;
            float halfWidth = halfHeight * uiCamera.aspect;

            // Corner positions
            // Note: _uiAnchor is rotated 180° on X, so Y is flipped
            //   Top of screen = negative Y
            //   Bottom of screen = positive Y
            //   Right side = positive X
            //   Left side = negative X

            float rightEdge = halfWidth;
            float leftEdge = -halfWidth;
            float topEdge = -halfHeight;      // Flipped due to rotation
            float bottomEdge = halfHeight;    // Flipped due to rotation

            // Input Mode Button: anchored to top-right corner
            // Offset moves it LEFT (subtract from X) and DOWN (add to Y)
            if (_inputModeButton != null)
            {
                float x = rightEdge - inputModeFromRight;
                float y = topEdge + inputModeFromTop;
                _inputModeButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Confirm Button: anchored to bottom-right corner
            // Offset moves it LEFT (subtract from X) and UP (subtract from Y)
            if (_confirmButton != null)
            {
                float x = rightEdge - confirmFromRight;
                float y = bottomEdge - confirmFromBottom;
                _confirmButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Cancel Button: anchored to bottom-right corner
            // Offset moves it LEFT (subtract from X) and UP (subtract from Y)
            if (_cancelButton != null)
            {
                float x = rightEdge - cancelFromRight;
                float y = bottomEdge - cancelFromBottom;
                _cancelButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Replay Button: centered on screen
            if (_replayButton != null)
            {
                _replayButton.transform.localPosition = new Vector3(0f, 0f, 0f);
            }
        }

        private void ApplyDockConfig()
        {
            if (uiCamera == null) return;

            bool isPortrait = Screen.height > Screen.width;

            float camHeight = uiCamera.orthographicSize;
            float camWidth = camHeight * uiCamera.aspect;

            // tileSize and tileSpacing are now set via Inspector
            // (no longer overwritten here)

            switch (currentDock)
            {
                case DockPosition.Bottom:
                    float bottomEdge = camHeight - 1.0f;

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(0f, -bottomEdge, _handDistance),
                        handDownPosition = new Vector3(0f, -bottomEdge - 1.5f, _handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, 0f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        isVerticalLayout = false
                    };
                    break;

                case DockPosition.Left:
                    float leftEdge = camWidth - 1.0f;

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(-leftEdge, 0f, _handDistance),
                        handDownPosition = new Vector3(-leftEdge - 1.5f, 0f, _handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, 90f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        isVerticalLayout = true
                    };
                    break;

                case DockPosition.Right:
                    float rightEdge = camWidth - 1.0f;

                    _currentConfig = new DockConfig
                    {
                        handUpPosition = new Vector3(rightEdge, 0f, _handDistance),
                        handDownPosition = new Vector3(rightEdge + 1.5f, 0f, _handDistance),
                        handRotation = Quaternion.Euler(180f, 0f, -90f),
                        tileSize = tileSize,
                        tileSpacing = tileSpacing,
                        isVerticalLayout = true
                    };
                    break;
            }

            // Apply hand configuration only
            _handAnchor.localPosition = _currentConfig.handUpPosition;
            _handAnchor.localRotation = _currentConfig.handRotation;

            // Update cycle prompt position (relative to hand)
            if (_cyclePromptText != null)
            {
                _cyclePromptText.transform.localPosition = new Vector3(0f, -1f, 0f);
            }

            // Refresh hand with new tile sizes
            RefreshHand();

            Debug.Log($"Dock applied: {currentDock}, Portrait: {isPortrait}, CamSize: {uiCamera.orthographicSize}");
        }

        /// <summary>
        /// Changes the dock position.
        /// </summary>
        public void SetDockPosition(DockPosition dock)
        {
            currentDock = dock;
            ApplyDockConfig();
            // Note: PositionUIElements is NOT called here - buttons stay put
        }

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

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshHand;
                GameManager.Instance.OnSelectionChanged -= OnSelectionChanged;
                GameManager.Instance.OnGameEnded -= OnGameEnded;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }
        }

        private void CreateReplayButton()
        {
            _replayButton = CreateButton(
                parent: _uiAnchor,
                name: "ReplayButton",
                scale: new Vector3(1f, 0.05f, 1f),
                material: confirmMaterial,
                labelText: "REPLAY",
                labelScale: new Vector3(0.025f, 0.025f, 0.025f),
                fontSize: 100,
                characterSize: 1f,
                onClick: OnReplayClicked,
                textMesh: out _
            );

            _replayButton.transform.localPosition = Vector3.zero;
            _replayButton.SetActive(false);
        }

        private void CreateMenuButton()
        {
            Material grayMaterial = new Material(Shader.Find("Standard"));
            grayMaterial.color = new Color(0.7f, 0.7f, 0.7f);

            _inputModeButton = CreateButton(
                parent: _uiAnchor,
                name: "MenuButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: grayMaterial,
                labelText: "=",
                labelScale: new Vector3(0.08f, 0.08f, 0.08f),
                fontSize: 100,
                characterSize: 0.5f,
                onClick: OnMenuClicked,
                textMesh: out _inputModeText
            );
        }

        public void OnMenuClicked()
        {
            MenuController.Instance?.ToggleMenu();
        }

        /// <summary>
        /// Hides hand tiles and cycle prompt when menu is open.
        /// </summary>
        public void HideHand()
        {
            if (_handAnchor != null)
            {
                _handAnchor.gameObject.SetActive(false);
            }
        }

        /// <summary>
        /// Shows hand tiles and cycle prompt when menu closes.
        /// </summary>
        public void ShowHand()
        {
            if (_handAnchor != null)
            {
                _handAnchor.gameObject.SetActive(true);
            }
        }

        private void OnGameEnded(Player? winner)
        {
            foreach (var tile in _handTileObjects)
            {
                tile.SetActive(false);
            }

            HideConfirmButton();
            HideCancelButton();
            _cyclePromptText.SetActive(false);

            _replayButton.SetActive(true);
        }

        private void OnGameRestarted()
        {
            _isInCycleMode = false;
            _selectedForDiscard.Clear();
            _cyclePromptText.SetActive(false);

            _replayButton.SetActive(false);

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

        public void OnReplayClicked()
        {
            _replayButton.SetActive(false);
            GameManager.Instance.InitializeGame();
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

        /// <summary>
        /// Creates a cylindrical button with a text label.
        /// </summary>
        private GameObject CreateButton(
            Transform parent,
            string name,
            Vector3 scale,
            Material material,
            string labelText,
            Vector3 labelScale,
            int fontSize,
            float characterSize,
            System.Action onClick,
            out TextMesh textMesh)
        {
            GameObject button = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            button.transform.SetParent(parent);
            button.transform.localPosition = Vector3.zero;
            button.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            button.transform.localScale = scale;
            button.name = name;
            button.GetComponent<Renderer>().shadowCastingMode = ShadowCastingMode.Off;
            button.layer = LayerMask.NameToLayer("UI3D");

            if (material != null)
            {
                button.GetComponent<Renderer>().material = material;
            }

            var handler = button.AddComponent<ButtonClickHandler>();
            handler.Initialize(onClick);

            GameObject textObj = new GameObject("Label");
            textObj.transform.SetParent(button.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = labelScale;
            textObj.layer = LayerMask.NameToLayer("UI3D");

            textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = labelText;
            textMesh.fontSize = fontSize;
            textMesh.characterSize = characterSize;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;

            return button;
        }

        private void CreateConfirmButton()
        {
            _confirmButton = CreateButton(
                parent: _uiAnchor,
                name: "ConfirmButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: confirmMaterial,
                labelText: "OK",
                labelScale: new Vector3(0.15f, 0.15f, 0.15f),
                fontSize: 32,
                characterSize: 1f,
                onClick: OnConfirmClicked,
                textMesh: out _
            );

            _confirmButton.SetActive(false);
            _confirmVisible = false;
        }

        private void CreateCancelButton()
        {
            _cancelButton = CreateButton(
                parent: _uiAnchor,
                name: "CancelButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: cancelMaterial,
                labelText: "X",
                labelScale: new Vector3(0.15f, 0.15f, 0.15f),
                fontSize: 32,
                characterSize: 1f,
                onClick: OnCancelClicked,
                textMesh: out _
            );

            _cancelButton.SetActive(false);
        }

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

            // Use fixed spacing - responsive scale handles fitting to screen
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

        /// <summary>
        /// Calculates the responsive scale factor based on screen width and aspect ratio.
        /// </summary>
        private float CalculateResponsiveScale()
        {
            if (uiCamera == null) return 1f;

            bool isPortrait = Screen.height > Screen.width;
            float aspect = uiCamera.aspect;

            // Calculate target width percent based on orientation
            float targetPercent;
            if (isPortrait)
            {
                targetPercent = portraitWidthPercent;
            }
            else
            {
                // Landscape: scale down for wider screens
                // At referenceAspect, use landscapeBasePercent
                // Wider = smaller percent
                targetPercent = landscapeBasePercent * (referenceAspect / aspect);
                // Clamp to reasonable range
                targetPercent = Mathf.Clamp(targetPercent, 0.2f, 0.95f);
            }

            // Calculate available width in world units
            float camWidth = uiCamera.orthographicSize * aspect * 2f;
            float targetWidth = camWidth * targetPercent;

            // Calculate natural hand width at scale 1.0 (based on max hand size)
            float naturalWidth = (maxHandSize - 1) * tileSpacing + tileSize;

            // Scale factor to fit target width
            return targetWidth / naturalWidth;
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
        /// Recalculates responsive scale and updates hand. Called when aspect ratio changes.
        /// </summary>
        private void RefreshResponsiveScale()
        {
            _responsiveScale = CalculateResponsiveScale();
            UpdateHandScale(animate: false);
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
            textObj.layer = LayerMask.NameToLayer("UI3D");

            if (currentDock == DockPosition.Left)
            {
                textObj.transform.localRotation = Quaternion.Euler(90f, -90f, 0f);
            }
            else if (currentDock == DockPosition.Right)
            {
                textObj.transform.localRotation = Quaternion.Euler(90f, 90f, 0f);
            }
            else
            {
                textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            }

            textObj.transform.localScale = new Vector3(0.05f, 0.05f, 0.05f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = letter.ToString();
            textMesh.fontSize = 100;
            textMesh.characterSize = 1.5f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;
        }

        /// <summary>
        /// Called when a hand tile is clicked.
        /// </summary>
        public void OnTileClicked(int index, char letter)
        {
            if (_isInCycleMode)
            {
                ToggleTileForDiscard(index);
                return;
            }

            if (GameManager.Instance.PendingDestination == null)
            {
                Debug.Log("Move your glyphling first!");
                return;
            }

            _selectedIndex = index;
            UpdateTileHighlights();

            Debug.Log($"Selected letter: {letter}");
            GameManager.Instance.SelectLetter(letter);

            if (GameManager.Instance.PendingCastPosition != null)
            {
                ShowConfirmButton();
            }
            ShowCancelButton();
        }

        /// <summary>
        /// Sets the selected tile index (used by drag handler).
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
                HideConfirmButton();
                HideCancelButton();
            }
            else if (GameManager.Instance.PendingDestination != null)
            {
                ShowCancelButton();

                if (GameManager.Instance.PendingCastPosition != null &&
                    GameManager.Instance.PendingLetter != null)
                {
                    ShowConfirmButton();
                }
            }
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
                // Ease out cubic
                t = 1f - Mathf.Pow(1f - t, 3f);
                _handAnchor.localScale = Vector3.Lerp(startScale, endScale, t);
                yield return null;
            }

            _handAnchor.localScale = endScale;
            _handScaleCoroutine = null;
        }

        private void EnterCycleMode()
        {
            _isInCycleMode = true;
            _selectedForDiscard.Clear();

            _cyclePromptText.SetActive(true);
            ShowConfirmButton();
            HideCancelButton();

            // Hand is active in cycle mode (interacting with letters)
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

        public void ShowCancelButton()
        {
            _cancelButton.SetActive(true);
        }

        public void HideCancelButton()
        {
            _cancelButton.SetActive(false);
        }

        public void OnConfirmClicked()
        {
            if (_isInCycleMode)
            {
                ConfirmCycleDiscard();
                return;
            }

            if (GameManager.Instance.PendingLetter != null)
            {
                GameManager.Instance.ConfirmMove();

                if (!GameManager.Instance.IsInCycleMode)
                {
                    HideConfirmButton();
                    HideCancelButton();
                }
            }
        }

        public void OnCancelClicked()
        {
            GameManager.Instance.ResetMove();
            HideCancelButton();
            HideConfirmButton();
        }

        private void ConfirmCycleDiscard()
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
            HideConfirmButton();

            // Hand returns to inactive state
            SetHandActive(false);
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
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            if (!GameManager.Instance.IsInCycleMode &&
                GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            Controller?.OnTileClicked(Index, Letter);
        }
    }

    /// <summary>
    /// Generic click handler for buttons. Takes a callback action.
    /// </summary>
    public class ButtonClickHandler : MonoBehaviour
    {
        private System.Action _onClick;

        public void Initialize(System.Action onClick)
        {
            _onClick = onClick;
        }

        private void OnMouseDown()
        {
            _onClick?.Invoke();
        }
    }
}