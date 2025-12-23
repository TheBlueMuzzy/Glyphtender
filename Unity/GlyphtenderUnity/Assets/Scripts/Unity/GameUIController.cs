using UnityEngine;
using Glyphtender.Core;
using UnityEngine.Rendering;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Manages game UI elements: buttons, prompts, and other non-hand UI.
    /// Attached to UI camera so it stays fixed during board zoom/pan.
    /// </summary>
    public class GameUIController : MonoBehaviour
    {
        public static GameUIController Instance { get; private set; }

        [Header("Camera")]
        public Camera uiCamera;

        [Header("Button Materials")]
        public Material confirmMaterial;
        public Material cancelMaterial;
        public Material menuMaterial;

        [Header("Button Group Scale (affects all buttons)")]
        [Tooltip("Master scale for all buttons - adjust this first")]
        public float buttonGroupScale = 1.0f;

        [Tooltip("Additional multiplier for landscape mode")]
        public float landscapeScaleBoost = 1.0f;

        [Header("Menu Button")]
        [Tooltip("Size multiplier for menu button")]
        public float menuSize = 1.0f;
        [Tooltip("Margin from right edge")]
        public float menuMarginRight = 0.5f;
        [Tooltip("Margin from top edge")]
        public float menuMarginTop = 0.5f;

        [Header("Confirm Button")]
        [Tooltip("Size multiplier for confirm button")]
        public float confirmSize = 1.0f;
        [Tooltip("Margin from right edge")]
        public float confirmMarginRight = 0.5f;
        [Tooltip("Margin from bottom edge")]
        public float confirmMarginBottom = 0.5f;

        [Header("Cancel Button")]
        [Tooltip("Size multiplier for cancel button")]
        public float cancelSize = 1.0f;
        [Tooltip("Margin from right edge")]
        public float cancelMarginRight = 0.5f;
        [Tooltip("Margin from bottom edge (stacks above confirm)")]
        public float cancelMarginAboveConfirm = 0.3f;

        // UI Anchor
        private Transform _uiAnchor;
        private float _uiDistance = 6f;
        private float _baseButtonSize = 0.75f;  // Internal base size

        // Buttons
        private GameObject _confirmButton;
        private GameObject _cancelButton;
        private GameObject _replayButton;
        private GameObject _menuButton;
        private TextMesh _menuButtonText;

        // Cycle prompt
        private GameObject _cyclePromptText;

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
                    Debug.LogError("GameUIController: No UI camera found!");
                    return;
                }
            }

            // Create UI anchor
            _uiAnchor = new GameObject("UIAnchor").transform;
            _uiAnchor.SetParent(uiCamera.transform);
            _uiAnchor.localPosition = new Vector3(0f, 0f, _uiDistance);
            _uiAnchor.localRotation = Quaternion.Euler(180f, 0f, 0f);

            // Subscribe to events
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnSelectionChanged += OnSelectionChanged;
                GameManager.Instance.OnTurnStateChanged += OnTurnStateChanged;
                GameManager.Instance.OnGameEnded += OnGameEnded;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;
            }

            // Subscribe to UIScaler layout changes
            if (UIScaler.Instance != null)
            {
                UIScaler.Instance.OnLayoutChanged += OnLayoutChanged;
            }

            // Create UI elements
            CreateConfirmButton();
            CreateCancelButton();
            CreateReplayButton();
            CreateMenuButton();
            CreateCyclePrompt();

            // Initialize positioning
            UpdateUIScale();
            PositionUIElements();
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnSelectionChanged -= OnSelectionChanged;
                GameManager.Instance.OnTurnStateChanged -= OnTurnStateChanged;
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
            UpdateUIScale();
            PositionUIElements();
        }

        /// <summary>
        /// Called when turn state changes - update button visibility.
        /// </summary>
        private void OnTurnStateChanged(GameTurnState newState)
        {
            UpdateButtonVisibility();
        }

        /// <summary>
        /// Applies the UI responsive scale to the UI anchor.
        /// Combines element scale (ortho size) with landscape scale (wider = bigger buttons).
        /// </summary>
        private void UpdateUIScale()
        {
            if (_uiAnchor == null || UIScaler.Instance == null) return;

            // Combine: UIScaler responsive + landscape boost + button group scale
            float elementScale = UIScaler.Instance.GetElementScale();
            float landscapeScale = UIScaler.Instance.GetLandscapeElementScale();

            // Apply additional landscape boost if not portrait
            if (!UIScaler.Instance.IsPortrait)
            {
                landscapeScale *= landscapeScaleBoost;
            }

            _uiAnchor.localScale = Vector3.one * elementScale * landscapeScale * buttonGroupScale;
        }

        /// <summary>
        /// Positions UI elements relative to screen corners using margins.
        /// Margins are from button edge to screen edge (margin=0 means button touches edge).
        /// </summary>
        private void PositionUIElements()
        {
            if (UIScaler.Instance == null || _uiAnchor == null) return;

            float halfHeight = UIScaler.Instance.HalfHeight;
            float halfWidth = UIScaler.Instance.HalfWidth;

            // Account for anchor scale - local positions need to be divided by scale
            // so they end up at the correct screen position after scaling
            float scaleFactor = _uiAnchor.localScale.x;
            if (scaleFactor <= 0) scaleFactor = 1f;

            // Note: _uiAnchor is rotated 180° on X, so Y is flipped
            // In this coordinate system: +X is right, +Y is down (bottom of screen)

            // Button radii in screen units (after scaling)
            float menuRadius = GetButtonRadius(menuSize) * scaleFactor;
            float confirmRadius = GetButtonRadius(confirmSize) * scaleFactor;
            float cancelRadius = GetButtonRadius(cancelSize) * scaleFactor;

            // Menu Button: top-right corner
            if (_menuButton != null)
            {
                // Position so button edge is margin away from screen edge
                float screenX = halfWidth - menuMarginRight - menuRadius;
                float screenY = -halfHeight + menuMarginTop + menuRadius;
                _menuButton.transform.localPosition = new Vector3(screenX / scaleFactor, screenY / scaleFactor, 0f);
            }

            // Confirm Button: bottom-right corner
            if (_confirmButton != null)
            {
                float screenX = halfWidth - confirmMarginRight - confirmRadius;
                float screenY = halfHeight - confirmMarginBottom - confirmRadius;
                _confirmButton.transform.localPosition = new Vector3(screenX / scaleFactor, screenY / scaleFactor, 0f);
            }

            // Cancel Button: above confirm button
            if (_cancelButton != null)
            {
                float confirmScreenY = halfHeight - confirmMarginBottom - confirmRadius;
                float cancelScreenX = halfWidth - cancelMarginRight - cancelRadius;
                float cancelScreenY = confirmScreenY - confirmRadius - cancelMarginAboveConfirm - cancelRadius;
                _cancelButton.transform.localPosition = new Vector3(cancelScreenX / scaleFactor, cancelScreenY / scaleFactor, 0f);
            }

            // Replay button: center of screen
            if (_replayButton != null)
            {
                _replayButton.transform.localPosition = new Vector3(0f, 0f, 0f);
            }
        }

        /// <summary>
        /// Gets the radius of a button given its size multiplier.
        /// </summary>
        private float GetButtonRadius(float sizeMultiplier)
        {
            return _baseButtonSize * sizeMultiplier * 0.5f;
        }

        #region Button Creation

        private void CreateConfirmButton()
        {
            _confirmButton = CreateButton(
                _uiAnchor,
                "ConfirmButton",
                new Vector3(_baseButtonSize * confirmSize, 0.1f, _baseButtonSize * confirmSize),
                confirmMaterial,
                labelText: "✓",
                labelScale: new Vector3(0.15f, 0.15f, 0.15f),
                fontSize: 32,
                characterSize: 1f,
                onClick: OnConfirmClicked,
                out _
            );
            _confirmButton.SetActive(false);
        }

        private void CreateCancelButton()
        {
            _cancelButton = CreateButton(
                _uiAnchor,
                "CancelButton",
                new Vector3(_baseButtonSize * cancelSize, 0.1f, _baseButtonSize * cancelSize),
                cancelMaterial,
                labelText: "✕",
                labelScale: new Vector3(0.15f, 0.15f, 0.15f),
                fontSize: 32,
                characterSize: 1f,
                onClick: OnCancelClicked,
                out _
            );
            _cancelButton.SetActive(false);
        }

        private void CreateReplayButton()
        {
            _replayButton = CreateButton(
                _uiAnchor,
                "ReplayButton",
                new Vector3(1.5f, 0.1f, 1.5f),
                confirmMaterial,
                labelText: "Play Again",
                labelScale: new Vector3(0.08f, 0.08f, 0.08f),
                fontSize: 32,
                characterSize: 1f,
                onClick: OnReplayClicked,
                out _
            );
            _replayButton.SetActive(false);
        }

        private void CreateMenuButton()
        {
            _menuButton = CreateButton(
                _uiAnchor,
                "MenuButton",
                new Vector3(_baseButtonSize * menuSize, 0.1f, _baseButtonSize * menuSize),
                menuMaterial,
                labelText: "≡",
                labelScale: new Vector3(0.2f, 0.2f, 0.2f),
                fontSize: 24,
                characterSize: 1f,
                onClick: OnMenuClicked,
                out _menuButtonText
            );
        }

        private void CreateCyclePrompt()
        {
            _cyclePromptText = new GameObject("CyclePrompt");
            _cyclePromptText.transform.SetParent(_uiAnchor);
            _cyclePromptText.transform.localPosition = new Vector3(0f, 2f, 0f);
            _cyclePromptText.transform.localRotation = Quaternion.identity;

            var textMesh = _cyclePromptText.AddComponent<TextMesh>();
            textMesh.text = "You may refresh any number of tiles.";
            textMesh.fontSize = 24;
            textMesh.characterSize = 0.15f;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            _cyclePromptText.SetActive(false);
        }

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
            handler.OnClick = onClick;

            // Create label
            GameObject labelObj = new GameObject("Label");
            labelObj.transform.SetParent(button.transform);
            labelObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            labelObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            labelObj.transform.localScale = labelScale;
            labelObj.layer = LayerMask.NameToLayer("UI3D");

            textMesh = labelObj.AddComponent<TextMesh>();
            textMesh.text = labelText;
            textMesh.fontSize = fontSize;
            textMesh.characterSize = characterSize;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.black;

            return button;
        }

        #endregion

        #region Button Visibility

        public void ShowConfirmButton()
        {
            _confirmButton.SetActive(true);
        }

        public void HideConfirmButton()
        {
            _confirmButton.SetActive(false);
        }

        public void ShowCancelButton()
        {
            _cancelButton.SetActive(true);
        }

        public void HideCancelButton()
        {
            _cancelButton.SetActive(false);
        }

        public void ShowCyclePrompt()
        {
            _cyclePromptText.SetActive(true);
        }

        public void HideCyclePrompt()
        {
            _cyclePromptText.SetActive(false);
        }

        #endregion

        #region Button Click Handlers

        private void OnConfirmClicked()
        {
            // Check if HandController is in cycle mode
            if (HandController.Instance != null && HandController.Instance.IsInCycleMode)
            {
                HandController.Instance.ConfirmCycleDiscard();
                HideConfirmButton();
                HideCancelButton();
                return;
            }

            if (GameManager.Instance.CurrentTurnState == GameTurnState.ReadyToConfirm)
            {
                // Don't hide buttons here - ConfirmMove may trigger cycle mode
                // which needs to show the confirm button. Let EnterCycleMode or
                // OnSelectionChanged handle button visibility.
                GameManager.Instance.ConfirmMove();
            }
        }

        private void OnCancelClicked()
        {
            // Return any placed hand tile back to hand
            HandTileDragHandler.ReturnCurrentlyPlacedTile();
            GameManager.Instance.ResetMove();
        }

        private void OnReplayClicked()
        {
            _replayButton.SetActive(false);
            GameManager.Instance.InitializeGame();
        }

        private void OnMenuClicked()
        {
            if (MenuController.Instance != null)
            {
                MenuController.Instance.ToggleMenu();
            }
        }

        #endregion

        #region Event Handlers

        private void OnSelectionChanged()
        {
            UpdateButtonVisibility();
        }

        /// <summary>
        /// Updates confirm/cancel button visibility based on current turn state.
        /// </summary>
        private void UpdateButtonVisibility()
        {
            // Check if HandController is in cycle mode
            if (HandController.Instance != null && HandController.Instance.IsInCycleMode)
            {
                return;
            }

            var state = GameManager.Instance.CurrentTurnState;

            // Show confirm only in ReadyToConfirm state
            if (state == GameTurnState.ReadyToConfirm)
            {
                ShowConfirmButton();
            }
            else
            {
                HideConfirmButton();
            }

            // Show cancel when there's a pending move (MovePending or ReadyToConfirm)
            if (state == GameTurnState.MovePending || state == GameTurnState.ReadyToConfirm)
            {
                ShowCancelButton();
            }
            else
            {
                HideCancelButton();
            }
        }

        private void OnGameEnded(Player? winner)
        {
            HideConfirmButton();
            HideCancelButton();
            _replayButton.SetActive(true);
        }

        private void OnGameRestarted()
        {
            _replayButton.SetActive(false);
            HideCyclePrompt();
        }

        #endregion
    }

    /// <summary>
    /// Handles clicks on UI buttons.
    /// </summary>
    public class ButtonClickHandler : MonoBehaviour
    {
        public System.Action OnClick { get; set; }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            OnClick?.Invoke();
        }
    }
}