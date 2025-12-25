using UnityEngine;
using UnityEngine.Rendering;
using System;
using System.Collections.Generic;
using Glyphtender.Core;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Tracks a menu row's components for enable/disable functionality.
    /// </summary>
    public class MenuRow
    {
        public GameObject Button;
        public Renderer ButtonRenderer;
        public TextMesh ValueText;
        public TextMesh LabelText;
        public MenuButtonClickHandler ClickHandler;
        public Color EnabledButtonColor;
        public Color EnabledTextColor;
        public bool IsEnabled = true;

        private static readonly Color DisabledButtonColor = new Color(0.2f, 0.2f, 0.22f);
        private static readonly Color DisabledTextColor = new Color(0.4f, 0.4f, 0.45f);

        public void SetEnabled(bool enabled)
        {
            IsEnabled = enabled;
            ClickHandler.IsEnabled = enabled;

            if (enabled)
            {
                ButtonRenderer.material.color = EnabledButtonColor;
                ValueText.color = EnabledTextColor;
                if (LabelText != null) LabelText.color = Color.white;
            }
            else
            {
                ButtonRenderer.material.color = DisabledButtonColor;
                ValueText.color = DisabledTextColor;
                if (LabelText != null) LabelText.color = DisabledTextColor;
            }
        }

        public void SetVisible(bool visible)
        {
            if (Button != null)
                Button.SetActive(visible);
            if (LabelText != null)
                LabelText.gameObject.SetActive(visible);
        }
    }

    /// <summary>
    /// Controls the in-game menu panel.
    /// 3D menu rendered by UICamera.
    /// </summary>
    public class MenuController : MonoBehaviour
    {
        public static MenuController Instance { get; private set; }

        [Header("References")]
        public Camera uiCamera;

        [Header("Appearance")]
        public Material panelMaterial;
        public Material buttonMaterial;
        public float panelWidth = 6.0f;
        public float panelHeight = 8.0f;
        public float menuZ = 5f;

        [Header("Animation")]
        public float openDuration = 0.15f;
        public float closeDuration = 0.1f;

        // Menu state
        private bool _isOpen;
        private GameObject _menuRoot;
        private GameObject _backgroundBlocker;
        private List<GameObject> _menuItems = new List<GameObject>();

        // Tracked rows for enable/disable
        private MenuRow _dragOffsetRow;
        private MenuRow _speedRow;

        // Animation
        private bool _isAnimating;
        private float _animationTime;
        private Vector3 _animationStartScale;
        private Vector3 _animationEndScale;

        public bool IsOpen => _isOpen;

        private void Awake()
        {
            Instance = this;
        }

        private void Start()
        {
            if (uiCamera == null)
            {
                var camObj = GameObject.Find("UICamera");
                if (camObj != null) uiCamera = camObj.GetComponent<Camera>();
            }

            CreateMenu();
            _menuRoot.SetActive(false);
        }

        private void Update()
        {
            // Q key always opens menu (escape hatch for AI vs AI)
            if (Input.GetKeyDown(KeyCode.Q) || Input.GetKeyDown(KeyCode.Escape))
            {
                ToggleMenu();
            }

            // Handle menu clicks when open
            if (_isOpen && !_isAnimating && Input.GetMouseButtonDown(0))
            {
                HandleMenuClick();
            }

            if (_isAnimating)
            {
                _animationTime += Time.deltaTime;
                float duration = _isOpen ? openDuration : closeDuration;
                float t = Mathf.Clamp01(_animationTime / duration);

                float eased = 1f - Mathf.Pow(1f - t, 3f);

                _menuRoot.transform.localScale = Vector3.Lerp(_animationStartScale, _animationEndScale, eased);

                if (t >= 1f)
                {
                    _isAnimating = false;
                    if (!_isOpen)
                    {
                        _menuRoot.SetActive(false);
                        _backgroundBlocker.SetActive(false);
                    }
                }
            }
        }

        private void HandleMenuClick()
        {
            Ray ray = uiCamera.ScreenPointToRay(Input.mousePosition);

            // Only raycast against UI3D layer
            int ui3dLayer = LayerMask.GetMask("UI3D");
            RaycastHit[] hits = Physics.RaycastAll(ray, 100f, ui3dLayer);

            if (hits.Length == 0)
            {
                CloseMenu();
                return;
            }

            // Find the closest hit
            RaycastHit closestHit = hits[0];
            foreach (var hit in hits)
            {
                if (hit.distance < closestHit.distance)
                {
                    closestHit = hit;
                }
            }

            // Check what we hit
            GameObject hitObj = closestHit.collider.gameObject;

            // If hit the background blocker, close menu
            if (hitObj == _backgroundBlocker)
            {
                CloseMenu();
                return;
            }

            // If hit a button or panel, do nothing (let button handlers work)
            // The button's OnMouseDown will fire separately
        }

        private void CreateMenu()
        {
            _menuRoot = new GameObject("MenuPanel");
            _menuRoot.transform.SetParent(uiCamera.transform);
            _menuRoot.transform.localPosition = new Vector3(0f, 0f, menuZ);
            _menuRoot.transform.localRotation = Quaternion.identity;
            _menuRoot.layer = LayerMask.NameToLayer("UI3D");
            CreateBackgroundBlocker();
            CreatePanelBackground();
            CreateTitle();

            // Menu rows - position relative to panel size
            float elementScale = panelHeight / 4.0f;
            float contentTop = (panelHeight / 2f) - (0.8f * elementScale);
            float rowSpacing = 0.55f * elementScale;

            float yPos = contentTop;

            // --- AI Speed (only enabled when AI is active) ---
            _speedRow = CreateMenuRow("AI Speed", yPos,
                () => {
                    var aiManager = AIManager.Instance;
                    if (aiManager == null) return "Normal";
                    return aiManager.CycleSpeed();
                },
                () => {
                    var aiManager = AIManager.Instance;
                    if (aiManager == null) return "Normal";
                    return aiManager.GetSpeedName();
                }
            );
            yPos -= rowSpacing;

            // --- Input Mode toggle ---
            CreateMenuRow("Input Mode", yPos,
                () => {
                    var newMode = GameManager.Instance.CurrentInputMode == GameManager.InputMode.Tap
                        ? GameManager.InputMode.Drag
                        : GameManager.InputMode.Tap;
                    GameManager.Instance.SetInputMode(newMode);
                    UpdateRowStates();
                    return newMode.ToString();
                },
                () => GameManager.Instance.CurrentInputMode.ToString()
            );
            yPos -= rowSpacing;

            // Drag Offset toggle (0, 1, 2) - hidden when Input Mode is Tap
            _dragOffsetRow = CreateMenuRow("Drag Offset", yPos,
                () => {
                    int current = Mathf.RoundToInt(GameSettings.DragOffset);
                    int next = (current + 1) % 3;
                    GameSettings.DragOffset = next;
                    return next.ToString();
                },
                () => Mathf.RoundToInt(GameSettings.DragOffset).ToString()
            );

            // Two buttons at bottom (like EndGameScreen)
            float buttonY = -(panelHeight / 2f) + (0.4f * elementScale);
            CreateBottomButtons(buttonY, elementScale);

            // Set initial row states
            UpdateRowStates();
        }

        private void CreateBottomButtons(float yPos, float scale)
        {
            // Restart button (left)
            GameObject restartBtn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            restartBtn.name = "RestartButton";
            restartBtn.transform.SetParent(_menuRoot.transform);
            restartBtn.transform.localPosition = new Vector3(-0.7f * scale, yPos, -0.08f);
            restartBtn.transform.localRotation = Quaternion.identity;
            restartBtn.transform.localScale = new Vector3(1.2f * scale, 0.35f * scale, 0.05f);
            restartBtn.layer = LayerMask.NameToLayer("UI3D");

            var restartRenderer = restartBtn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                restartRenderer.material = buttonMaterial;
            else
                restartRenderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            restartRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            GameObject restartText = new GameObject("Text");
            restartText.transform.SetParent(restartBtn.transform);
            restartText.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            restartText.transform.localRotation = Quaternion.identity;
            restartText.transform.localScale = new Vector3(0.04f, 0.12f, 1f);
            restartText.layer = LayerMask.NameToLayer("UI3D");

            var restartTextMesh = restartText.AddComponent<TextMesh>();
            restartTextMesh.text = "Restart";
            restartTextMesh.fontSize = 36;
            restartTextMesh.alignment = TextAlignment.Center;
            restartTextMesh.anchor = TextAnchor.MiddleCenter;
            restartTextMesh.color = Color.white;

            var restartHandler = restartBtn.AddComponent<MenuButtonClickHandler>();
            restartHandler.OnClick = () => {
                CloseMenu();
                GameManager.Instance.InitializeGame();
            };

            _menuItems.Add(restartBtn);

            // Quit button (right)
            GameObject quitBtn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            quitBtn.name = "QuitButton";
            quitBtn.transform.SetParent(_menuRoot.transform);
            quitBtn.transform.localPosition = new Vector3(0.7f * scale, yPos, -0.08f);
            quitBtn.transform.localRotation = Quaternion.identity;
            quitBtn.transform.localScale = new Vector3(1.2f * scale, 0.35f * scale, 0.05f);
            quitBtn.layer = LayerMask.NameToLayer("UI3D");

            var quitRenderer = quitBtn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                quitRenderer.material = buttonMaterial;
            else
                quitRenderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            quitRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            GameObject quitText = new GameObject("Text");
            quitText.transform.SetParent(quitBtn.transform);
            quitText.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            quitText.transform.localRotation = Quaternion.identity;
            quitText.transform.localScale = new Vector3(0.04f, 0.12f, 1f);
            quitText.layer = LayerMask.NameToLayer("UI3D");

            var quitTextMesh = quitText.AddComponent<TextMesh>();
            quitTextMesh.text = "Menu";
            quitTextMesh.fontSize = 36;
            quitTextMesh.alignment = TextAlignment.Center;
            quitTextMesh.anchor = TextAnchor.MiddleCenter;
            quitTextMesh.color = Color.white;

            var quitHandler = quitBtn.AddComponent<MenuButtonClickHandler>();
            quitHandler.OnClick = () => {
                CloseMenu();
                ReturnToMainMenu();
            };

            _menuItems.Add(quitBtn);

            // Quit button (below, centered) - exits app (hidden in WebGL)
#if !UNITY_WEBGL
            float closeY = yPos - (0.5f * scale);
            GameObject closeBtn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            closeBtn.name = "CloseButton";
            closeBtn.transform.SetParent(_menuRoot.transform);
            closeBtn.transform.localPosition = new Vector3(0f, closeY, -0.08f);
            closeBtn.transform.localRotation = Quaternion.identity;
            closeBtn.transform.localScale = new Vector3(1.2f * scale, 0.35f * scale, 0.05f);
            closeBtn.layer = LayerMask.NameToLayer("UI3D");

            var closeRenderer = closeBtn.GetComponent<Renderer>();
            if (buttonMaterial != null)
                closeRenderer.material = buttonMaterial;
            else
                closeRenderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            closeRenderer.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;

            GameObject closeText = new GameObject("Text");
            closeText.transform.SetParent(closeBtn.transform);
            closeText.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            closeText.transform.localRotation = Quaternion.identity;
            closeText.transform.localScale = new Vector3(0.04f, 0.12f, 1f);
            closeText.layer = LayerMask.NameToLayer("UI3D");

            var closeTextMesh = closeText.AddComponent<TextMesh>();
            closeTextMesh.text = "Quit";
            closeTextMesh.fontSize = 36;
            closeTextMesh.alignment = TextAlignment.Center;
            closeTextMesh.anchor = TextAnchor.MiddleCenter;
            closeTextMesh.color = Color.white;

            var closeHandler = closeBtn.AddComponent<MenuButtonClickHandler>();
            closeHandler.OnClick = () => {
                Application.Quit();
#if UNITY_EDITOR
                UnityEditor.EditorApplication.isPlaying = false;
#endif
            };

            _menuItems.Add(closeBtn);
#endif
        }

        private void ReturnToMainMenu()
        {
            // Set flag so game waits for main menu
            if (GameManager.Instance != null)
            {
                GameManager.Instance.WaitingForMainMenu = true;
            }

            // Clear the board
            if (BoardRenderer.Instance != null)
            {
                BoardRenderer.Instance.ClearBoard();
            }

            // Hide confirm/cancel buttons
            if (GameUIController.Instance != null)
            {
                GameUIController.Instance.HideConfirmButton();
                GameUIController.Instance.HideCancelButton();
            }

            // Show main menu
            if (MainMenuScreen.Instance != null)
            {
                MainMenuScreen.Instance.Show();
            }
        }

        private void UpdateRowStates()
        {
            var aiManager = AIManager.Instance;

            // Drag Offset: hidden when Input Mode = Tap
            if (_dragOffsetRow != null)
            {
                bool dragEnabled = GameManager.Instance.CurrentInputMode == GameManager.InputMode.Drag;
                _dragOffsetRow.SetVisible(dragEnabled);
            }

            // Speed: only enabled when at least one AI is active
            if (_speedRow != null)
            {
                bool hasAI = aiManager != null && aiManager.HasAnyAI;
                _speedRow.SetEnabled(hasAI);
            }
        }

        private void CreateBackgroundBlocker()
        {
            _backgroundBlocker = GameObject.CreatePrimitive(PrimitiveType.Quad);
            _backgroundBlocker.name = "BackgroundBlocker";
            _backgroundBlocker.transform.SetParent(uiCamera.transform);
            _backgroundBlocker.transform.localPosition = new Vector3(0f, 0f, menuZ + 0.5f);
            _backgroundBlocker.transform.localRotation = Quaternion.identity;
            _backgroundBlocker.transform.localScale = new Vector3(50f, 50f, 1f);
            _backgroundBlocker.layer = LayerMask.NameToLayer("UI3D");

            var renderer = _backgroundBlocker.GetComponent<Renderer>();
            Material invisMat = new Material(Shader.Find("Standard"));
            invisMat.color = new Color(0, 0, 0, 0);
            invisMat.SetFloat("_Mode", 3);
            invisMat.SetInt("_SrcBlend", (int)BlendMode.SrcAlpha);
            invisMat.SetInt("_DstBlend", (int)BlendMode.OneMinusSrcAlpha);
            invisMat.SetInt("_ZWrite", 0);
            invisMat.DisableKeyword("_ALPHATEST_ON");
            invisMat.EnableKeyword("_ALPHABLEND_ON");
            invisMat.renderQueue = 3000;
            renderer.material = invisMat;
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Add component to identify this as the background blocker
            _backgroundBlocker.AddComponent<MenuBackgroundClickHandler>();

            _backgroundBlocker.SetActive(false);
        }

        private void CreatePanelBackground()
        {
            GameObject panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            panel.name = "PanelBackground";
            panel.transform.SetParent(_menuRoot.transform);
            panel.transform.localPosition = new Vector3(0f, 0f, 0f);
            panel.transform.localRotation = Quaternion.identity;
            panel.transform.localScale = new Vector3(panelWidth, panelHeight, 0.05f);
            panel.layer = LayerMask.NameToLayer("UI3D");

            var renderer = panel.GetComponent<Renderer>();
            if (panelMaterial != null)
            {
                renderer.material = panelMaterial;
            }
            else
            {
                renderer.material.color = new Color(0.15f, 0.15f, 0.18f);
            }
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Add click handler to consume clicks on panel (prevents background from closing menu)
            var panelHandler = panel.AddComponent<MenuButtonClickHandler>();
            panelHandler.OnClick = () => { }; // Do nothing, just block clicks
        }

        private void CreateTitle()
        {
            // Scale factor based on panel height
            float elementScale = panelHeight / 4.0f;

            GameObject titleObj = new GameObject("Title");
            titleObj.transform.SetParent(_menuRoot.transform);
            // Position title near top of panel with buffer
            float titleY = (panelHeight / 2f) - (0.35f * elementScale);
            titleObj.transform.localPosition = new Vector3(0f, titleY, -0.1f);
            titleObj.transform.localRotation = Quaternion.identity;
            titleObj.transform.localScale = new Vector3(0.1f, 0.1f, 0.1f) * elementScale;
            titleObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = titleObj.AddComponent<TextMesh>();
            textMesh.text = "MENU";
            textMesh.fontSize = 48;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;
        }

        private MenuRow CreateMenuRow(string label, float yPos, Func<string> onToggle, Func<string> getValue)
        {
            var row = new MenuRow();

            // Scale factor based on panel height (reference: 4.0)
            float elementScale = panelHeight / 4.0f;

            // Feature label (left side)
            GameObject labelObj = new GameObject($"Label_{label}");
            labelObj.transform.SetParent(_menuRoot.transform);
            labelObj.transform.localPosition = new Vector3(-1.3f * elementScale, yPos, -0.1f);
            labelObj.transform.localRotation = Quaternion.identity;
            labelObj.transform.localScale = new Vector3(0.055f, 0.055f, 0.055f) * elementScale;
            labelObj.layer = LayerMask.NameToLayer("UI3D");

            var labelText = labelObj.AddComponent<TextMesh>();
            labelText.text = label;
            labelText.fontSize = 36;
            labelText.alignment = TextAlignment.Left;
            labelText.anchor = TextAnchor.MiddleLeft;
            labelText.color = Color.white;
            row.LabelText = labelText;

            // Toggle button (right side)
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = $"Toggle_{label}";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = new Vector3(0.85f * elementScale, yPos, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(1.1f, 0.35f, 0.05f) * elementScale;
            btn.layer = LayerMask.NameToLayer("UI3D");
            row.Button = btn;

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
            {
                renderer.material = buttonMaterial;
            }
            else
            {
                renderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            }
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            row.ButtonRenderer = renderer;
            row.EnabledButtonColor = renderer.material.color;

            // Value text on button (smaller than label)
            GameObject valueObj = new GameObject("Value");
            valueObj.transform.SetParent(btn.transform);
            valueObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            valueObj.transform.localRotation = Quaternion.identity;
            valueObj.transform.localScale = new Vector3(0.045f, 0.12f, 1f);
            valueObj.layer = LayerMask.NameToLayer("UI3D");

            var valueText = valueObj.AddComponent<TextMesh>();
            valueText.text = getValue();
            valueText.fontSize = 36;
            valueText.alignment = TextAlignment.Center;
            valueText.anchor = TextAnchor.MiddleCenter;
            valueText.color = new Color(0.85f, 0.9f, 1f);
            row.ValueText = valueText;
            row.EnabledTextColor = valueText.color;

            // Click handler
            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => {
                valueText.text = onToggle();
            };
            row.ClickHandler = handler;

            _menuItems.Add(btn);

            return row;
        }

        private void CreateActionButton(string text, float yPos, Action onClick)
        {
            // Scale factor based on panel height (reference: 4.0)
            float elementScale = panelHeight / 4.0f;

            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = $"Button_{text}";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = new Vector3(0f, yPos, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(2f, 0.4f, 0.05f) * elementScale;
            btn.layer = LayerMask.NameToLayer("UI3D");

            var renderer = btn.GetComponent<Renderer>();
            if (buttonMaterial != null)
            {
                renderer.material = buttonMaterial;
            }
            else
            {
                renderer.material.color = new Color(0.3f, 0.3f, 0.35f);
            }
            renderer.shadowCastingMode = ShadowCastingMode.Off;

            // Button text
            GameObject textObj = new GameObject("Text");
            textObj.transform.SetParent(btn.transform);
            textObj.transform.localPosition = new Vector3(0f, 0f, -1.5f);
            textObj.transform.localRotation = Quaternion.identity;
            textObj.transform.localScale = new Vector3(0.04f, 0.1f, 1f);
            textObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = text;
            textMesh.fontSize = 36;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;

            // Click handler
            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = onClick;

            _menuItems.Add(btn);
        }

        public void OpenMenu()
        {
            if (_isOpen || _isAnimating) return;

            _isOpen = true;
            _menuRoot.SetActive(true);
            _backgroundBlocker.SetActive(true);

            // Update row states when opening
            UpdateRowStates();

            // Hide hand elements and buttons
            HandController.Instance?.HideHand();
            GameUIController.Instance?.HideConfirmButton();
            GameUIController.Instance?.HideCancelButton();

            _animationStartScale = Vector3.zero;
            _animationEndScale = Vector3.one;
            _menuRoot.transform.localScale = _animationStartScale;
            _animationTime = 0f;
            _isAnimating = true;
        }

        public void CloseMenu()
        {
            if (!_isOpen || _isAnimating) return;

            _isOpen = false;

            // Show hand elements and restore button visibility
            HandController.Instance?.ShowHand();
            GameUIController.Instance?.UpdateButtonVisibility();

            _animationStartScale = Vector3.one;
            _animationEndScale = Vector3.zero;
            _animationTime = 0f;
            _isAnimating = true;

            // After closing, check if AI should take turn
            TriggerAIIfNeeded();
        }

        /// <summary>
        /// Triggers AI turn if current player is AI-controlled and not already thinking.
        /// Called when menu closes to "unpause" AI.
        /// </summary>
        private void TriggerAIIfNeeded()
        {
            if (GameManager.Instance?.GameState == null) return;

            var aiManager = AIManager.Instance;
            if (aiManager == null) return;

            var currentPlayer = GameManager.Instance.GameState.CurrentPlayer;
            var currentAI = aiManager.GetAIForPlayer(currentPlayer);

            // Only trigger if AI exists and isn't already thinking
            if (currentAI != null && !currentAI.IsThinking)
            {
                currentAI.TakeTurn(GameManager.Instance.GameState);
            }
        }

        public void ToggleMenu()
        {
            if (_isOpen)
                CloseMenu();
            else
                OpenMenu();
        }
    }

    public class MenuBackgroundClickHandler : MonoBehaviour
    {
        // This class exists to identify the background blocker
        // Click handling is done centrally in MenuController.HandleMenuClick()
    }

    public class MenuButtonClickHandler : MonoBehaviour
    {
        public Action OnClick { get; set; }
        public bool IsEnabled { get; set; } = true;

        private void OnMouseDown()
        {
            if (IsEnabled)
            {
                OnClick?.Invoke();
            }
        }
    }
}