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

        [Header("Button Size")]
        public float buttonSize = 0.75f;

        [Header("Menu Button (anchored to top-right corner)")]
        public float menuFromRight = 1.0f;
        public float menuFromTop = 1.0f;

        [Header("Confirm Button (anchored to bottom-right corner)")]
        public float confirmFromRight = 1.0f;
        public float confirmFromBottom = 1.75f;

        [Header("Cancel Button (anchored to bottom-right corner)")]
        public float cancelFromRight = 1.0f;
        public float cancelFromBottom = 3.0f;

        // UI Anchor
        private Transform _uiAnchor;
        private float _uiDistance = 6f;

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
        /// Applies the UI responsive scale to the UI anchor.
        /// </summary>
        private void UpdateUIScale()
        {
            if (_uiAnchor == null || UIScaler.Instance == null) return;
            float scale = UIScaler.Instance.GetLandscapeElementScale() * UIScaler.Instance.GetElementScale();
            _uiAnchor.localScale = Vector3.one * scale;
        }

        /// <summary>
        /// Positions UI elements relative to screen corners.
        /// </summary>
        private void PositionUIElements()
        {
            if (UIScaler.Instance == null) return;

            float halfHeight = UIScaler.Instance.HalfHeight;
            float halfWidth = UIScaler.Instance.HalfWidth;

            // Note: _uiAnchor is rotated 180° on X, so Y is flipped
            float rightEdge = halfWidth;
            float leftEdge = -halfWidth;
            float topEdge = -halfHeight;
            float bottomEdge = halfHeight;

            // Menu Button: top-right
            if (_menuButton != null)
            {
                float x = rightEdge - menuFromRight;
                float y = topEdge + menuFromTop;
                _menuButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Confirm Button: bottom-right
            if (_confirmButton != null)
            {
                float x = rightEdge - confirmFromRight;
                float y = bottomEdge - confirmFromBottom;
                _confirmButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Cancel Button: bottom-right, above confirm
            if (_cancelButton != null)
            {
                float x = rightEdge - cancelFromRight;
                float y = bottomEdge - cancelFromBottom;
                _cancelButton.transform.localPosition = new Vector3(x, y, 0f);
            }

            // Replay Button: center
            if (_replayButton != null)
            {
                _replayButton.transform.localPosition = new Vector3(0f, 0f, 0f);
            }
        }

        #region Button Creation

        private void CreateConfirmButton()
        {
            _confirmButton = CreateButton(
                parent: _uiAnchor,
                name: "ConfirmButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: confirmMaterial,
                labelText: "✓",
                labelScale: new Vector3(0.15f, 0.15f, 0.15f),
                fontSize: 24,
                characterSize: 1f,
                onClick: OnConfirmClicked,
                out _
            );
            _confirmButton.SetActive(false);
        }

        private void CreateCancelButton()
        {
            _cancelButton = CreateButton(
                parent: _uiAnchor,
                name: "CancelButton",
                scale: new Vector3(buttonSize * 0.8f, 0.05f, buttonSize * 0.8f),
                material: cancelMaterial,
                labelText: "X",
                labelScale: new Vector3(0.12f, 0.12f, 0.12f),
                fontSize: 24,
                characterSize: 1f,
                onClick: OnCancelClicked,
                out _
            );
            _cancelButton.SetActive(false);
        }

        private void CreateReplayButton()
        {
            _replayButton = CreateButton(
                parent: _uiAnchor,
                name: "ReplayButton",
                scale: new Vector3(buttonSize * 2f, 0.05f, buttonSize * 2f),
                material: confirmMaterial,
                labelText: "Play Again",
                labelScale: new Vector3(0.08f, 0.08f, 0.08f),
                fontSize: 24,
                characterSize: 1f,
                onClick: OnReplayClicked,
                out _
            );
            _replayButton.SetActive(false);
        }

        private void CreateMenuButton()
        {
            _menuButton = CreateButton(
                parent: _uiAnchor,
                name: "MenuButton",
                scale: new Vector3(buttonSize, 0.05f, buttonSize),
                material: menuMaterial,
                labelText: "=",
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
            var handController = FindObjectOfType<HandController>();
            if (handController != null && handController.IsInCycleMode)
            {
                handController.ConfirmCycleDiscard();
                return;
            }

            if (GameManager.Instance.CurrentTurnState == GameTurnState.ReadyToConfirm)
            {
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
            // Check if HandController is in cycle mode
            var handController = FindObjectOfType<HandController>();
            if (handController != null && handController.IsInCycleMode)
            {
                return;
            }

            if (GameManager.Instance.SelectedGlyphling == null)
            {
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