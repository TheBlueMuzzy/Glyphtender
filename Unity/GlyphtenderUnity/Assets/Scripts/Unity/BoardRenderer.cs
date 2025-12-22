using UnityEngine;
using Glyphtender.Core;
using System.Collections.Generic;

namespace Glyphtender.Unity
{
    /// <summary>
    /// Renders the hex board, tiles, and glyphlings.
    /// </summary>
    public class BoardRenderer : MonoBehaviour
    {
        [Header("Prefabs")]
        public GameObject hexPrefab;
        public GameObject tilePrefab;
        public GameObject glyphlingPrefab;

        [Header("Materials")]
        public Material hexDefaultMaterial;
        public Material hexHighlightMaterial;
        public Material hexValidMoveMaterial;
        public Material hexValidCastMaterial;
        public Material yellowMaterial;
        public Material blueMaterial;
        public Material yellowCastMaterial;
        public Material blueCastMaterial;
        public Material hexHoverMaterial;

        [Header("Settings")]
        [Tooltip("Size of each hex (when equal to hexSpacing, they touch)")]
        public float hexSize = 0.9f;

        [Tooltip("Distance between hex centers")]
        public float hexSpacing = 1f;

        [Tooltip("Size of glyphling spheres (relative to hexSize)")]
        public float glyphlingSize = 0.5f;

        [Header("Animation")]
        public float moveDuration = 0.5f;
        public float resetDuration = 0.05f;
        public float tileCastDuration = 0.3f;
        public float tileResetDuration = 0.1f;

        private Dictionary<Glyphling, Vector3> _glyphlingTargets;

        private HexCoord? _highlightedCastPosition;
        private Vector3 _originalHexScale;

        private HexCoord? _hoverHighlightedHex;
        private Material _originalHoverMaterial;

        private GameObject _ghostTile;
        private Dictionary<Glyphling, bool> _trappedGlyphlings = new Dictionary<Glyphling, bool>();
        private Dictionary<Glyphling, float> _trappedPulseTime = new Dictionary<Glyphling, float>();

        // Rendered objects
        private Dictionary<HexCoord, GameObject> _hexObjects;
        private Dictionary<HexCoord, GameObject> _tileObjects;
        private Dictionary<Glyphling, GameObject> _glyphlingObjects;

        // Hex geometry constants for flat-top
        private float _hexWidth;
        private float _hexHeight;

        private void Awake()
        {
            _hexObjects = new Dictionary<HexCoord, GameObject>();
            _tileObjects = new Dictionary<HexCoord, GameObject>();
            _glyphlingObjects = new Dictionary<Glyphling, GameObject>();

            _glyphlingTargets = new Dictionary<Glyphling, Vector3>();

            // Flat-top hex dimensions (for camera fitting)
            _hexWidth = hexSpacing * 2f;
            _hexHeight = hexSpacing * Mathf.Sqrt(3f);
        }

        private void Update()
        {

            // Pulse trapped glyphlings
            foreach (var glyphling in _glyphlingObjects.Keys)
            {
                bool isTrapped = TangleChecker.IsTangled(GameManager.Instance.GameState, glyphling);

                if (isTrapped)
                {
                    if (!_trappedPulseTime.ContainsKey(glyphling))
                    {
                        _trappedPulseTime[glyphling] = 0f;
                    }

                    _trappedPulseTime[glyphling] += Time.deltaTime;
                    float pulse = (Mathf.Sin(_trappedPulseTime[glyphling] * 4f) + 1f) / 2f;

                    var renderer = _glyphlingObjects[glyphling].GetComponent<Renderer>();
                    if (renderer != null)
                    {
                        Color baseColor = glyphling.Owner == Player.Yellow ? Color.yellow : Color.blue;
                        Color trappedColor = Color.red;
                        renderer.material.color = Color.Lerp(baseColor, trappedColor, pulse * 0.5f);
                    }
                }
                else
                {
                    // Reset color when no longer trapped
                    if (_trappedPulseTime.ContainsKey(glyphling))
                    {
                        _trappedPulseTime.Remove(glyphling);

                        // Restore original material
                        var renderer = _glyphlingObjects[glyphling].GetComponent<Renderer>();
                        if (renderer != null)
                        {
                            Material mat = glyphling.Owner == Player.Yellow ? yellowMaterial : blueMaterial;
                            if (mat != null)
                            {
                                renderer.material = mat;
                            }
                        }
                    }
                }
            }
        }

        private void Start()
        {
            // Delay initialization to ensure GameManager is ready
            Invoke("Initialize", 0.1f);
        }

        private void Initialize()
        {

            TweenManager.EnsureExists();

            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged += RefreshBoard;
                GameManager.Instance.OnSelectionChanged += RefreshHighlights;
                GameManager.Instance.OnGameRestarted += OnGameRestarted;

                // Initial render
                CreateBoard();
                RefreshBoard();

                Debug.Log("BoardRenderer initialized.");
            }
            else
            {
                Debug.LogError("GameManager.Instance is null!");
            }
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnGameStateChanged -= RefreshBoard;
                GameManager.Instance.OnSelectionChanged -= RefreshHighlights;
                GameManager.Instance.OnGameRestarted -= OnGameRestarted;
            }
        }

        /// <summary>
        /// Converts hex coordinates to world position.
        /// </summary>
        public Vector3 HexToWorld(HexCoord hex)
        {
            // Flat-top hex layout with independent columns
            float x = hexSpacing * 1.5f * hex.Column;

            // Offset odd columns by half a hex height
            float zOffset = (hex.Column % 2 == 1) ? hexSpacing * Mathf.Sqrt(3f) / 2f : 0f;
            float z = hexSpacing * Mathf.Sqrt(3f) * hex.Row + zOffset;

            return new Vector3(x, 0f, z);
        }

        /// <summary>
        /// Converts world position to nearest hex coordinate.
        /// </summary>
        public HexCoord WorldToHex(Vector3 worldPos)
        {
            // Reverse of HexToWorld
            // x = hexSpacing * 1.5f * column
            // z = hexSpacing * sqrt(3) * row + offset (offset = hexSpacing * sqrt(3) / 2 for odd columns)

            // First estimate column from x
            float colFloat = worldPos.x / (hexSpacing * 1.5f);
            int col = Mathf.RoundToInt(colFloat);

            // Clamp column to valid range
            col = Mathf.Clamp(col, 0, Board.Columns - 1);

            // Calculate z offset for this column
            float zOffset = (col % 2 == 1) ? hexSpacing * Mathf.Sqrt(3f) / 2f : 0f;

            // Calculate row from z
            float rowFloat = (worldPos.z - zOffset) / (hexSpacing * Mathf.Sqrt(3f));
            int row = Mathf.RoundToInt(rowFloat);

            return new HexCoord(col, row);
        }

        /// <summary>
        /// Creates the initial board hexes.
        /// </summary>
        public void CreateBoard()
        {
            if (GameManager.Instance?.GameState == null) return;

            var board = GameManager.Instance.GameState.Board;

            foreach (var hex in board.BoardHexes)
            {
                CreateHex(hex);
            }

            Debug.Log($"Created {_hexObjects.Count} hex objects.");
        }

        private void CreateHex(HexCoord coord)
        {
            GameObject hexObj;

            if (hexPrefab != null)
            {
                hexObj = Instantiate(hexPrefab, HexToWorld(coord), Quaternion.identity, transform);
            }
            else
            {
                // Create simple placeholder cylinder if no prefab
                hexObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                hexObj.transform.position = HexToWorld(coord);
                // Scale by sqrt(3) so that when hexSize == hexSpacing, circles touch
                float visualSize = hexSize * Mathf.Sqrt(3f);
                hexObj.transform.localScale = new Vector3(visualSize, 0.1f, visualSize);
                hexObj.transform.SetParent(transform);

                if (hexDefaultMaterial != null)
                {
                    hexObj.GetComponent<Renderer>().material = hexDefaultMaterial;
                }
            }

            hexObj.name = $"Hex_{coord.Column}_{coord.Row}";

            // Add HexClickHandler component
            var clickHandler = hexObj.AddComponent<HexClickHandler>();
            clickHandler.Coord = coord;
            clickHandler.BoardRenderer = this;

            // Add HexDragHandler for drag mode
            var dragHandler = hexObj.AddComponent<HexDragHandler>();
            dragHandler.Coord = coord;
            dragHandler.BoardRenderer = this;

            _hexObjects[coord] = hexObj;
        }

        /// <summary>
        /// Refreshes all dynamic elements (tiles, glyphlings).
        /// </summary>
        public void RefreshBoard()
        {
            if (GameManager.Instance?.GameState == null) return;

            RefreshTiles();
            RefreshGlyphlings();
            RefreshHighlights();
        }

        private void RefreshTiles()
        {
            var state = GameManager.Instance.GameState;

            // Remove tiles that no longer exist
            var toRemove = new List<HexCoord>();
            foreach (var kvp in _tileObjects)
            {
                if (!state.Tiles.ContainsKey(kvp.Key))
                {
                    Destroy(kvp.Value);
                    toRemove.Add(kvp.Key);
                }
            }
            foreach (var coord in toRemove)
            {
                _tileObjects.Remove(coord);
            }

            // Add/update tiles
            foreach (var kvp in state.Tiles)
            {
                if (!_tileObjects.ContainsKey(kvp.Key))
                {
                    CreateTile(kvp.Key, kvp.Value);
                }
            }
        }

        private void CreateTile(HexCoord coord, Tile tile)
        {
            // Get the starting position (from the glyphling that cast it)
            Vector3 startPos = HexToWorld(coord) + Vector3.up * 0.15f; // Default
            if (GameManager.Instance.LastCastOrigin != null)
            {
                startPos = HexToWorld(GameManager.Instance.LastCastOrigin.Value) + Vector3.up * 0.3f;
            }

            Vector3 targetPos = HexToWorld(coord) + Vector3.up * 0.15f;

            GameObject tileObj;

            if (tilePrefab != null)
            {
                tileObj = Instantiate(tilePrefab, startPos, Quaternion.identity, transform);
            }
            else
            {
                // Create cylinder as hex placeholder (matching hand tiles)
                tileObj = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                tileObj.transform.position = startPos;
                tileObj.transform.localRotation = Quaternion.Euler(0f, 0f, 0f);
                tileObj.transform.localScale = new Vector3(hexSize * 1.5f, 0.1f, hexSize * 1.5f);
                tileObj.transform.SetParent(transform);

                // Color by owner
                var material = tile.Owner == Player.Yellow ? yellowMaterial : blueMaterial;
                if (material != null)
                {
                    tileObj.GetComponent<Renderer>().material = material;
                }

                // Add letter text
                GameObject textObj = new GameObject("Letter");
                textObj.transform.SetParent(tileObj.transform);
                textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
                textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
                textObj.transform.localScale = new Vector3(0.3f, 0.3f, 0.3f);

                var textMesh = textObj.AddComponent<TextMesh>();
                textMesh.text = tile.Letter.ToString();
                textMesh.fontSize = 32;
                textMesh.alignment = TextAlignment.Center;
                textMesh.anchor = TextAnchor.MiddleCenter;
                textMesh.color = Color.black;
            }

            tileObj.name = $"Tile_{tile.Letter}_{coord.Column}_{coord.Row}";

            _tileObjects[coord] = tileObj;

            // Animate tile from cast origin to destination
            TweenManager.Instance.MoveFromTo(tileObj.transform, startPos, targetPos, tileCastDuration);
        }

        private void RefreshGlyphlings()
        {
            var state = GameManager.Instance.GameState;

            foreach (var glyphling in state.Glyphlings)
            {
                if (!_glyphlingObjects.ContainsKey(glyphling))
                {
                    CreateGlyphling(glyphling);
                }

                var obj = _glyphlingObjects[glyphling];
                Vector3 targetPos = HexToWorld(glyphling.Position) + Vector3.up * 0.3f;

                // Check if position changed (compare to current target, not current position)
                if (!_glyphlingTargets.ContainsKey(glyphling) || _glyphlingTargets[glyphling] != targetPos)
                {
                    _glyphlingTargets[glyphling] = targetPos;

                    // Use fast duration for reset (snap back), normal for moves
                    float duration = GameManager.Instance.IsResetting ? resetDuration : moveDuration;

                    TweenManager.Instance.MoveTo(obj.transform, targetPos, duration);
                }
            }
        }

        private void CreateGlyphling(Glyphling glyphling)
        {
            GameObject obj;

            if (glyphlingPrefab != null)
            {
                Vector3 spawnPos = HexToWorld(glyphling.Position) + Vector3.up * 0.3f;
                obj = Instantiate(glyphlingPrefab, spawnPos, Quaternion.identity, transform);
            }
            else
            {
                // Simple placeholder sphere
                obj = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                Vector3 spawnPos = HexToWorld(glyphling.Position) + Vector3.up * 0.3f;
                obj.transform.position = spawnPos;
                obj.transform.localScale = new Vector3(hexSize * glyphlingSize, hexSize * glyphlingSize, hexSize * glyphlingSize);
                obj.transform.SetParent(transform);

                // Color by owner
                var material = glyphling.Owner == Player.Yellow ? yellowMaterial : blueMaterial;
                if (material != null)
                {
                    obj.GetComponent<Renderer>().material = material;
                }

                // Remove collider - selection is handled by hex
                var collider = obj.GetComponent<Collider>();
                if (collider != null)
                {
                    Destroy(collider);
                }
            }

            obj.name = $"Glyphling_{glyphling.Owner}_{glyphling.Index}";

            // No click/drag handlers needed - hex handles all interaction

            _glyphlingObjects[glyphling] = obj;
        }

        /// <summary>
        /// Gets the glyphling at a hex coordinate, if any.
        /// </summary>
        public Glyphling GetGlyphlingAt(HexCoord coord)
        {
            var state = GameManager.Instance?.GameState;
            if (state == null) return null;

            foreach (var g in state.Glyphlings)
            {
                if (g.Position.Equals(coord))
                {
                    return g;
                }
            }
            return null;
        }

        /// <summary>
        /// Gets the GameObject for a glyphling.
        /// </summary>
        public GameObject GetGlyphlingObject(Glyphling glyphling)
        {
            if (glyphling != null && _glyphlingObjects.TryGetValue(glyphling, out var obj))
            {
                return obj;
            }
            return null;
        }

        /// <summary>
        /// Updates hex highlighting based on current selection.
        /// </summary>
        public void RefreshHighlights()
        {
            if (GameManager.Instance == null) return;

            // Reset previously highlighted cast position scale
            if (_highlightedCastPosition != null && _hexObjects.TryGetValue(_highlightedCastPosition.Value, out var prevHex))
            {
                prevHex.transform.localScale = _originalHexScale;
            }
            _highlightedCastPosition = null;

            // Reset all hexes to default
            foreach (var kvp in _hexObjects)
            {
                SetHexMaterial(kvp.Key, hexDefaultMaterial);
            }

            // Highlight valid moves
            foreach (var coord in GameManager.Instance.ValidMoves)
            {
                SetHexMaterial(coord, hexValidMoveMaterial);
            }

            // Highlight valid casts with player-specific color
            foreach (var coord in GameManager.Instance.ValidCasts)
            {
                // Use player's cast color, fallback to generic if not set
                Material castMat = GameManager.Instance.GameState.CurrentPlayer == Player.Yellow
                    ? (yellowCastMaterial ?? hexValidCastMaterial)
                    : (blueCastMaterial ?? hexValidCastMaterial);
                SetHexMaterial(coord, castMat);
            }

            // Scale up selected cast position
            var pendingCast = GameManager.Instance.PendingCastPosition;
            if (pendingCast != null && _hexObjects.TryGetValue(pendingCast.Value, out var hexObj))
            {
                _originalHexScale = hexObj.transform.localScale;
                _highlightedCastPosition = pendingCast;
                hexObj.transform.localScale = _originalHexScale * 1.3f;
            }
        }

        /// <summary>
        /// Highlights a hex as the current hover/drop target.
        /// </summary>
        public void SetHoverHighlight(HexCoord coord)
        {
            // Clear previous hover
            ClearHoverHighlight();

            if (_hexObjects.TryGetValue(coord, out var hexObj))
            {
                var renderer = hexObj.GetComponent<Renderer>();
                if (renderer != null)
                {
                    _originalHoverMaterial = renderer.material;
                    _hoverHighlightedHex = coord;

                    if (hexHoverMaterial != null)
                    {
                        renderer.material = hexHoverMaterial;
                    }
                }
            }
        }

        /// <summary>
        /// Clears the hover highlight.
        /// </summary>
        public void ClearHoverHighlight()
        {
            if (_hoverHighlightedHex != null && _hexObjects.TryGetValue(_hoverHighlightedHex.Value, out var hexObj))
            {
                var renderer = hexObj.GetComponent<Renderer>();
                if (renderer != null && _originalHoverMaterial != null)
                {
                    renderer.material = _originalHoverMaterial;
                }
            }
            _hoverHighlightedHex = null;
            _originalHoverMaterial = null;
        }
        private void OnGameRestarted()
        {
            // Clear all tiles from board
            foreach (var tile in _tileObjects.Values)
            {
                Destroy(tile);
            }
            _tileObjects.Clear();

            // Clear all glyphlings (new ones will be created)
            foreach (var obj in _glyphlingObjects.Values)
            {
                Destroy(obj);
            }
            _glyphlingObjects.Clear();
            _glyphlingTargets.Clear();

            // Clear trapped state
            _trappedPulseTime.Clear();

            // Reset highlights
            RefreshHighlights();

            // Refresh board to create new glyphlings
            RefreshBoard();
        }
        public void ShowGhostTile(HexCoord position, char letter, Player owner)
        {
            HideGhostTile();

            Vector3 pos = HexToWorld(position) + Vector3.up * 0.2f;

            _ghostTile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            _ghostTile.transform.position = pos;
            _ghostTile.transform.localRotation = Quaternion.Euler(0f, 0f, 0f);
            _ghostTile.transform.localScale = new Vector3(hexSize * 1.5f, 0.1f, hexSize * 1.5f);
            _ghostTile.transform.SetParent(transform);
            _ghostTile.name = "GhostTile";

            // Semi-transparent material
            var renderer = _ghostTile.GetComponent<Renderer>();
            Material mat = new Material(owner == Player.Yellow ? yellowMaterial : blueMaterial);
            Color c = mat.color;
            c.a = 0.5f;
            mat.color = c;

            // Enable transparency
            mat.SetFloat("_Mode", 3);
            mat.SetInt("_SrcBlend", (int)UnityEngine.Rendering.BlendMode.SrcAlpha);
            mat.SetInt("_DstBlend", (int)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
            mat.SetInt("_ZWrite", 0);
            mat.DisableKeyword("_ALPHATEST_ON");
            mat.EnableKeyword("_ALPHABLEND_ON");
            mat.DisableKeyword("_ALPHAPREMULTIPLY_ON");
            mat.renderQueue = 3000;

            renderer.material = mat;

            // Add letter text
            GameObject textObj = new GameObject("Letter");
            textObj.transform.SetParent(_ghostTile.transform);
            textObj.transform.localPosition = new Vector3(0f, 0.6f, 0f);
            textObj.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            textObj.transform.localScale = new Vector3(0.3f, 0.3f, 0.3f);

            var textMesh = textObj.AddComponent<TextMesh>();
            textMesh.text = letter.ToString();
            textMesh.fontSize = 32;
            textMesh.alignment = TextAlignment.Center;
            textMesh.anchor = TextAnchor.MiddleCenter;
            textMesh.color = new Color(0f, 0f, 0f, 0.7f);
        }

        public void HideGhostTile()
        {
            if (_ghostTile != null)
            {
                Destroy(_ghostTile);
                _ghostTile = null;
            }
        }

        private void SetHexMaterial(HexCoord coord, Material material)
        {
            if (_hexObjects.TryGetValue(coord, out var hexObj) && material != null)
            {
                var renderer = hexObj.GetComponent<Renderer>();
                if (renderer != null)
                {
                    renderer.material = material;
                }
            }
        }
    }

    /// <summary>
    /// Handles tap input on hex tiles.
    /// Now also handles glyphling selection - tap the hex to select the glyphling on it.
    /// </summary>
    public class HexClickHandler : MonoBehaviour
    {
        public HexCoord Coord { get; set; }
        public BoardRenderer BoardRenderer { get; set; }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            // Only handle in tap mode
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            if (GameManager.Instance == null) return;

            // Don't allow board interaction during cycle mode
            if (GameManager.Instance.CurrentTurnState == GameTurnState.CycleMode)
                return;

            var state = GameManager.Instance.GameState;

            // First, check if there's a glyphling at this hex
            Glyphling glyphlingHere = BoardRenderer.GetGlyphlingAt(Coord);

            // If there's a glyphling here and it belongs to current player, select it
            if (glyphlingHere != null && glyphlingHere.Owner == state.CurrentPlayer)
            {
                // If we're mid-turn, reset the current move first
                var turnState = GameManager.Instance.CurrentTurnState;
                if (turnState == GameTurnState.GlyphlingSelected ||
                    turnState == GameTurnState.MovePending ||
                    turnState == GameTurnState.ReadyToConfirm)
                {
                    // Return any placed hand tile back to hand
                    HandTileDragHandler.ReturnCurrentlyPlacedTile();
                    GameManager.Instance.ResetMove();
                }

                GameManager.Instance.SelectGlyphling(glyphlingHere);
                return;
            }

            // Otherwise, check for valid moves/casts
            if (GameManager.Instance.ValidMoves.Contains(Coord))
            {
                GameManager.Instance.SelectDestination(Coord);
            }
            else if (GameManager.Instance.ValidCasts.Contains(Coord))
            {
                GameManager.Instance.SelectCastPosition(Coord);
            }
        }
    }

    /// <summary>
    /// Handles drag input on hex tiles for glyphling movement.
    /// Tap a hex with your glyphling to start dragging it.
    /// </summary>
    public class HexDragHandler : MonoBehaviour
    {
        public HexCoord Coord { get; set; }
        public BoardRenderer BoardRenderer { get; set; }

        private bool _isDragging;
        private Glyphling _draggedGlyphling;
        private GameObject _draggedObject;
        private Vector3 _originalPosition;
        private HexCoord? _hoveredHex;
        private Camera _mainCamera;
        private int _dragFingerId = -1;  // Track which finger started the drag

        private static bool _isAnyDragging;
        public static bool IsDraggingGlyphling => _isAnyDragging;

        private void Start()
        {
            _mainCamera = Camera.main;
        }

        private void OnMouseDown()
        {
            // Block input when menu is open
            if (MenuController.Instance != null && MenuController.Instance.IsOpen)
                return;

            // Only handle in drag mode
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Drag)
                return;

            if (GameManager.Instance == null) return;

            // Don't allow board interaction during cycle mode
            if (GameManager.Instance.CurrentTurnState == GameTurnState.CycleMode)
                return;

            var state = GameManager.Instance.GameState;

            // Check if there's a current player's glyphling at this hex
            Glyphling glyphlingHere = BoardRenderer.GetGlyphlingAt(Coord);

            if (glyphlingHere != null && glyphlingHere.Owner == state.CurrentPlayer)
            {
                // If we're mid-turn, reset the current move first
                var turnState = GameManager.Instance.CurrentTurnState;
                if (turnState == GameTurnState.GlyphlingSelected ||
                    turnState == GameTurnState.MovePending ||
                    turnState == GameTurnState.ReadyToConfirm)
                {
                    // Return any placed hand tile back to hand
                    HandTileDragHandler.ReturnCurrentlyPlacedTile();
                    GameManager.Instance.ResetMove();
                }

                // Capture which finger started this drag
                _dragFingerId = -1;  // -1 means mouse
                if (Input.touchCount > 0)
                {
                    // Find the touch that's at this position
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

                // Start dragging this glyphling
                _draggedGlyphling = glyphlingHere;
                _draggedObject = BoardRenderer.GetGlyphlingObject(glyphlingHere);

                if (_draggedObject != null)
                {
                    // Get original position from glyphling's DATA position, not visual
                    // This ensures we return to correct spot after ResetMove changes data
                    _originalPosition = BoardRenderer.HexToWorld(glyphlingHere.Position) + Vector3.up * 0.3f;

                    // Also sync the visual to match data immediately
                    _draggedObject.transform.position = _originalPosition;

                    _isDragging = true;
                    _isAnyDragging = true;

                    // Select this glyphling
                    GameManager.Instance.SelectGlyphling(glyphlingHere);

                    Debug.Log($"Started dragging glyphling from {glyphlingHere.Position}, fingerId={_dragFingerId}");
                }
            }
        }

        private void Update()
        {
            if (!_isDragging || _draggedObject == null) return;

            // Get position from the specific finger that started the drag
            Vector3 screenPos = Vector3.zero;
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
                    // Move glyphling to follow this specific finger
                    // Convert screen position to world position on the board plane (Y=0)
                    Ray ray = _mainCamera.ScreenPointToRay(screenPos);
                    float distance = ray.origin.y / -ray.direction.y;
                    Vector3 mouseWorldPos = ray.origin + ray.direction * distance;

                    // Apply vertical offset so dragged object is visible above finger
                    float offset = GameSettings.GetDragOffsetWorld();
                    _draggedObject.transform.position = new Vector3(
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
                _draggedObject.transform.position = new Vector3(
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
            // Check which hex we're hovering over
            HexCoord? newHoveredHex = BoardRenderer.WorldToHex(mouseWorldPos);

            if (newHoveredHex != _hoveredHex)
            {
                _hoveredHex = newHoveredHex;

                // Show highlight if over a valid move destination
                if (_hoveredHex != null && GameManager.Instance.ValidMoves.Contains(_hoveredHex.Value))
                {
                    BoardRenderer.SetHoverHighlight(_hoveredHex.Value);
                }
                else
                {
                    BoardRenderer.ClearHoverHighlight();
                }
            }
        }

        private void EndDrag()
        {
            _isDragging = false;
            _isAnyDragging = false;
            BoardRenderer.ClearHoverHighlight();

            // Check if dropped on valid hex
            if (_hoveredHex != null && GameManager.Instance.ValidMoves.Contains(_hoveredHex.Value))
            {
                // Valid drop - select destination
                GameManager.Instance.SelectDestination(_hoveredHex.Value);

                // Snap glyphling to destination
                Vector3 destPos = BoardRenderer.HexToWorld(_hoveredHex.Value) + Vector3.up * 0.3f;
                _draggedObject.transform.position = destPos;

                Debug.Log($"Dropped glyphling on {_hoveredHex.Value}");
            }
            else
            {
                // Invalid drop - return to original position and reset game state
                _draggedObject.transform.position = _originalPosition;
                GameManager.Instance.ResetMove();

                Debug.Log("Invalid drop - returning glyphling and resetting move");
            }

            _hoveredHex = null;
            _draggedGlyphling = null;
            _draggedObject = null;
        }
    }
}