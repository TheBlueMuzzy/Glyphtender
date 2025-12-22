using UnityEngine;
using UnityEngine.Rendering;
using System;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Controls the in-game menu panel.
    /// 3D menu rendered by UICamera.
    /// </summary>
    public class MenuController : MonoBehaviour
    {
        public static MenuController Instance { get; private set; }

        [Header("References")]
        public Camera uiCamera;
        public HandController handController;

        [Header("Appearance")]
        public Material panelMaterial;
        public Material buttonMaterial;
        public float panelWidth = 3.2f;
        public float panelHeight = 2.5f;
        public float menuZ = 5f;

        [Header("Animation")]
        public float openDuration = 0.15f;
        public float closeDuration = 0.1f;

        // Menu state
        private bool _isOpen;
        private GameObject _menuRoot;
        private GameObject _backgroundBlocker;
        private List<GameObject> _menuItems = new List<GameObject>();

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

            if (handController == null)
            {
                handController = FindObjectOfType<HandController>();
            }

            CreateMenu();
            _menuRoot.SetActive(false);
        }

        private void Update()
        {
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

            // Menu rows
            float yPos = 0.6f;
            float rowSpacing = 0.55f;

            // Input Mode toggle
            CreateMenuRow("Input Mode", yPos,
                () => {
                    var newMode = GameManager.Instance.CurrentInputMode == GameManager.InputMode.Tap
                        ? GameManager.InputMode.Drag
                        : GameManager.InputMode.Tap;
                    GameManager.Instance.SetInputMode(newMode);
                    return newMode.ToString();
                },
                () => GameManager.Instance.CurrentInputMode.ToString()
            );
            yPos -= rowSpacing;

            // Drag Offset toggle (0, 1, 2)
            CreateMenuRow("Drag Offset", yPos,
                () => {
                    int current = Mathf.RoundToInt(GameSettings.DragOffset);
                    int next = (current + 1) % 3;
                    GameSettings.DragOffset = next;
                    return next.ToString();
                },
                () => Mathf.RoundToInt(GameSettings.DragOffset).ToString()
            );
            yPos -= rowSpacing;

            // Hand Dock toggle
            CreateMenuRow("Hand Dock", yPos,
                () => {
                    DockPosition current = handController?.currentDock ?? DockPosition.Bottom;
                    DockPosition next = current switch
                    {
                        DockPosition.Bottom => DockPosition.Left,
                        DockPosition.Left => DockPosition.Right,
                        DockPosition.Right => DockPosition.Bottom,
                        _ => DockPosition.Bottom
                    };
                    handController?.SetDockPosition(next);
                    return next.ToString();
                },
                () => handController?.currentDock.ToString() ?? "Bottom"
            );
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

            var handler = _backgroundBlocker.AddComponent<MenuBackgroundClickHandler>();
            handler.MenuController = this;

            _backgroundBlocker.SetActive(false);
        }

        private void CreatePanelBackground()
        {
            GameObject panel = GameObject.CreatePrimitive(PrimitiveType.Cube);
            panel.name = "PanelBackground";
            panel.transform.SetParent(_menuRoot.transform);
            panel.transform.localPosition = new Vector3(0f, 0.2f, 0f);
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

            Destroy(panel.GetComponent<Collider>());
        }

        private void CreateTitle()
        {
            GameObject titleObj = new GameObject("Title");
            titleObj.transform.SetParent(_menuRoot.transform);
            titleObj.transform.localPosition = new Vector3(0f, 1.2f, -0.1f);
            titleObj.transform.localRotation = Quaternion.identity;
            titleObj.transform.localScale = new Vector3(0.1f, 0.1f, 0.1f);
            titleObj.layer = LayerMask.NameToLayer("UI3D");

            var textMesh = titleObj.AddComponent<TextMesh>();
            textMesh.text = "MENU";
            textMesh.fontSize = 48;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = Color.white;
        }

        private void CreateMenuRow(string label, float yPos, Func<string> onToggle, Func<string> getValue)
        {
            // Feature label (left side)
            GameObject labelObj = new GameObject($"Label_{label}");
            labelObj.transform.SetParent(_menuRoot.transform);
            labelObj.transform.localPosition = new Vector3(-1.3f, yPos, -0.1f);
            labelObj.transform.localRotation = Quaternion.identity;
            labelObj.transform.localScale = new Vector3(0.055f, 0.055f, 0.055f);
            labelObj.layer = LayerMask.NameToLayer("UI3D");

            var labelText = labelObj.AddComponent<TextMesh>();
            labelText.text = label;
            labelText.fontSize = 36;
            labelText.alignment = TextAlignment.Left;
            labelText.anchor = TextAnchor.MiddleLeft;
            labelText.color = Color.white;

            // Toggle button (right side)
            GameObject btn = GameObject.CreatePrimitive(PrimitiveType.Cube);
            btn.name = $"Toggle_{label}";
            btn.transform.SetParent(_menuRoot.transform);
            btn.transform.localPosition = new Vector3(0.85f, yPos, -0.08f);
            btn.transform.localRotation = Quaternion.identity;
            btn.transform.localScale = new Vector3(1.1f, 0.35f, 0.05f);
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

            // Click handler
            var handler = btn.AddComponent<MenuButtonClickHandler>();
            handler.OnClick = () => {
                valueText.text = onToggle();
            };

            _menuItems.Add(btn);
        }

        public void OpenMenu()
        {
            if (_isOpen || _isAnimating) return;

            _isOpen = true;
            _menuRoot.SetActive(true);
            _backgroundBlocker.SetActive(true);

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

            _animationStartScale = Vector3.one;
            _animationEndScale = Vector3.zero;
            _animationTime = 0f;
            _isAnimating = true;
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
        public MenuController MenuController { get; set; }

        private void OnMouseDown()
        {
            MenuController?.CloseMenu();
        }
    }

    public class MenuButtonClickHandler : MonoBehaviour
    {
        public Action OnClick { get; set; }

        private void OnMouseDown()
        {
            OnClick?.Invoke();
        }
    }
}