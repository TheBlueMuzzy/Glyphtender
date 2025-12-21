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
        public Material hexHoverMaterial;

        [Header("Settings")]
        public float hexSize = 1f;

        [Header("Animation")]
        public float moveDuration = 0.5f;
        public float resetDuration = 0.05f;
        public float tileCastDuration = 0.3f;
        public float tileResetDuration = 0.1f;

        private Dictionary<Glyphling, Vector3> _glyphlingTargets;
        private Dictionary<Glyphling, Vector3> _glyphlingStarts;
        private Dictionary<Glyphling, float> _glyphlingLerpTime;
        private Dictionary<Glyphling, float> _glyphlingLerpDuration;

        private Dictionary<HexCoord, Vector3> _tileTargets;
        private Dictionary<HexCoord, Vector3> _tileStarts;
        private Dictionary<HexCoord, float> _tileLerpTime;
        private Dictionary<HexCoord, float> _tileLerpDuration;

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
            _glyphlingStarts = new Dictionary<Glyphling, Vector3>();
            _glyphlingLerpTime = new Dictionary<Glyphling, float>();
            _glyphlingLerpDuration = new Dictionary<Glyphling, float>();

            _tileTargets = new Dictionary<HexCoord, Vector3>();
            _tileStarts = new Dictionary<HexCoord, Vector3>();
            _tileLerpTime = new Dictionary<HexCoord, float>();
            _tileLerpDuration = new Dictionary<HexCoord, float>();

            // Flat-top hex dimensions
            _hexWidth = hexSize * 2f;
            _hexHeight = hexSize * Mathf.Sqrt(3f);
        }

        private void Update()
        {
            // Lerp glyphlings toward their targets
            foreach (var glyphling in _glyphlingObjects.Keys)
            {
                if (_glyphlingTargets.TryGetValue(glyphling, out Vector3 target))
                {
                    var obj = _glyphlingObjects[glyphling];
                    _glyphlingLerpTime[glyphling] += Time.deltaTime;

                    float duration = _glyphlingLerpDuration.TryGetValue(glyphling, out float d) ? d : moveDuration;
                    float t = Mathf.Clamp01(_glyphlingLerpTime[glyphling] / duration);

                    // Smooth step for nicer easing
                    t = t * t * (3f - 2f * t);

                    Vector3 start = _glyphlingStarts.TryGetValue(glyphling, out Vector3 s) ? s : obj.transform.position;
                    obj.transform.position = Vector3.Lerp(start, target, t);
                }
            }

            // Lerp tiles toward their targets
            foreach (var coord in new List<HexCoord>(_tileTargets.Keys))
            {
                if (_tileObjects.TryGetValue(coord, out GameObject tileObj))
                {
                    _tileLerpTime[coord] += Time.deltaTime;
                    float duration = _tileLerpDuration.TryGetValue(coord, out float d) ? d : tileCastDuration;
                    float t = Mathf.Clamp01(_tileLerpTime[coord] / duration);

                    // Smooth step for nicer easing
                    t = t * t * (3f - 2f * t);

                    Vector3 start = _tileStarts[coord];
                    Vector3 target = _tileTargets[coord];
                    tileObj.transform.position = Vector3.Lerp(start, target, t);

                    // Remove from tracking when done
                    if (t >= 1f)
                    {
                        _tileTargets.Remove(coord);
                        _tileStarts.Remove(coord);
                        _tileLerpTime.Remove(coord);
                        _tileLerpDuration.Remove(coord);
                    }
                }
            }
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
            float x = hexSize * 1.5f * hex.Column;

            // Offset odd columns by half a hex height
            float zOffset = (hex.Column % 2 == 1) ? hexSize * Mathf.Sqrt(3f) / 2f : 0f;
            float z = hexSize * Mathf.Sqrt(3f) * hex.Row + zOffset;

            return new Vector3(x, 0f, z);
        }

        /// <summary>
        /// Converts world position to nearest hex coordinate.
        /// </summary>
        public HexCoord WorldToHex(Vector3 worldPos)
        {
            // Reverse of HexToWorld
            // x = hexSize * 1.5f * column
            // z = hexSize * sqrt(3) * row + offset (offset = hexSize * sqrt(3) / 2 for odd columns)

            // First estimate column from x
            float colFloat = worldPos.x / (hexSize * 1.5f);
            int col = Mathf.RoundToInt(colFloat);

            // Clamp column to valid range
            col = Mathf.Clamp(col, 0, Board.Columns - 1);

            // Calculate z offset for this column
            float zOffset = (col % 2 == 1) ? hexSize * Mathf.Sqrt(3f) / 2f : 0f;

            // Calculate row from z
            float rowFloat = (worldPos.z - zOffset) / (hexSize * Mathf.Sqrt(3f));
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
                hexObj.transform.localScale = new Vector3(hexSize * 0.9f, 0.1f, hexSize * 0.9f);
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

            // Set up lerp animation
            _tileStarts[coord] = startPos;
            _tileTargets[coord] = targetPos;
            _tileLerpTime[coord] = 0f;
            _tileLerpDuration[coord] = tileCastDuration;
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

                // Check if position changed
                if (!_glyphlingTargets.ContainsKey(glyphling) || _glyphlingTargets[glyphling] != targetPos)
                {
                    _glyphlingStarts[glyphling] = obj.transform.position;
                    _glyphlingTargets[glyphling] = targetPos;
                    _glyphlingLerpTime[glyphling] = 0f;

                    // Use fast duration for reset (snap back), normal for moves
                    _glyphlingLerpDuration[glyphling] = GameManager.Instance.IsResetting ? resetDuration : moveDuration;
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
                obj.transform.localScale = new Vector3(hexSize * 0.5f, hexSize * 0.5f, hexSize * 0.5f);
                obj.transform.SetParent(transform); ;

                // Color by owner
                var material = glyphling.Owner == Player.Yellow ? yellowMaterial : blueMaterial;
                if (material != null)
                {
                    obj.GetComponent<Renderer>().material = material;
                }
            }

            obj.name = $"Glyphling_{glyphling.Owner}_{glyphling.Index}";

            // Add click handler
            var clickHandler = obj.AddComponent<GlyphlingClickHandler>();
            clickHandler.Glyphling = glyphling;

            // Add drag handler
            var dragHandler = obj.AddComponent<GlyphlingDragHandler>();
            dragHandler.Glyphling = glyphling;

            _glyphlingObjects[glyphling] = obj;
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

            // Highlight valid casts
            foreach (var coord in GameManager.Instance.ValidCasts)
            {
                SetHexMaterial(coord, hexValidCastMaterial);
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
            _tileTargets.Clear();
            _tileStarts.Clear();
            _tileLerpTime.Clear();
            _tileLerpDuration.Clear();

            // Clear all glyphlings (new ones will be created)
            foreach (var obj in _glyphlingObjects.Values)
            {
                Destroy(obj);
            }
            _glyphlingObjects.Clear();
            _glyphlingTargets.Clear();
            _glyphlingStarts.Clear();
            _glyphlingLerpTime.Clear();
            _glyphlingLerpDuration.Clear();

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
    /// Handles clicks on hex tiles.
    /// </summary>
    public class HexClickHandler : MonoBehaviour
    {
        public HexCoord Coord { get; set; }

        private void OnMouseDown()
        {
            // Only handle in tap mode
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            if (GameManager.Instance == null) return;

            // Determine what action to take based on game state
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
    /// Handles clicks on glyphlings.
    /// </summary>
    public class GlyphlingClickHandler : MonoBehaviour
    {
        public Glyphling Glyphling { get; set; }

        private void OnMouseDown()
        {
            // Only handle in tap mode
            if (GameManager.Instance.CurrentInputMode != GameManager.InputMode.Tap)
                return;

            if (GameManager.Instance == null) return;

            GameManager.Instance.SelectGlyphling(Glyphling);
        }
    }
}