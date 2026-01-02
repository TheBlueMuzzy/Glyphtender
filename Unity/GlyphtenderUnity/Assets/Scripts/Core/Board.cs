using System;
using System.Collections.Generic;

namespace Glyphtender.Core
{
    /// <summary>
    /// Axial coordinate for flat-top hexagonal grid.
    /// Uses (q, r) axial coordinates.
    /// </summary>
    public struct HexCoord : IEquatable<HexCoord>
    {
        public readonly int Column;
        public readonly int Row;

        public HexCoord(int column, int row)
        {
            Column = column;
            Row = row;
        }

        // Cube coordinate S (derived from column and row)
        public int CubeCoordinate => -Column - Row;

        // Neighbor offsets for flat-top hex grid with offset columns
        // Even columns (0, 2, 4...) and odd columns (1, 3, 5...) have different offsets
        public static readonly HexCoord[] DirectionsEvenCol = new HexCoord[]
        {
            new HexCoord(0, -1),   // North
            new HexCoord(1, -1),   // Northeast (up-right)
            new HexCoord(1, 0),    // Southeast (down-right)
            new HexCoord(0, 1),    // South
            new HexCoord(-1, 0),   // Southwest (down-left)
            new HexCoord(-1, -1)   // Northwest (up-left)
        };

        public static readonly HexCoord[] DirectionsOddCol = new HexCoord[]
        {
            new HexCoord(0, -1),   // North
            new HexCoord(1, 0),    // Northeast (up-right)
            new HexCoord(1, 1),    // Southeast (down-right)
            new HexCoord(0, 1),    // South
            new HexCoord(-1, 1),   // Southwest (down-left)
            new HexCoord(-1, 0)    // Northwest (up-left)
        };

        public HexCoord GetNeighbor(int direction)
        {
            var dirs = (Column % 2 == 0) ? DirectionsEvenCol : DirectionsOddCol;
            var dir = dirs[direction % 6];
            return new HexCoord(Column + dir.Column, Row + dir.Row);
        }

        public IEnumerable<HexCoord> GetAllNeighbors()
        {
            for (int i = 0; i < 6; i++)
            {
                yield return GetNeighbor(i);
            }
        }

        public int DistanceTo(HexCoord other)
        {
            return (Math.Abs(Column - other.Column) + Math.Abs(Row - other.Row) + Math.Abs(CubeCoordinate - other.CubeCoordinate)) / 2;
        }

        public static HexCoord operator +(HexCoord a, HexCoord b)
        {
            return new HexCoord(a.Column + b.Column, a.Row + b.Row);
        }

        public static HexCoord operator -(HexCoord a, HexCoord b)
        {
            return new HexCoord(a.Column - b.Column, a.Row - b.Row);
        }

        public static bool operator ==(HexCoord a, HexCoord b)
        {
            return a.Column == b.Column && a.Row == b.Row;
        }

        public static bool operator !=(HexCoord a, HexCoord b)
        {
            return !(a == b);
        }

        public bool Equals(HexCoord other)
        {
            return Column == other.Column && Row == other.Row;
        }

        public override bool Equals(object obj)
        {
            return obj is HexCoord other && Equals(other);
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(Column, Row);
        }

        public override string ToString()
        {
            return $"({Column}, {Row})";
        }
    }

    /// <summary>
    /// Board size options.
    /// </summary>
    public enum BoardSize
    {
        Small,   // 9 columns, 61 hexes
        Medium,  // 11 columns, 85 hexes (default)
        Large    // 13 columns, 106 hexes
    }

    /// <summary>
    /// Configuration data for a board size.
    /// </summary>
    public class BoardConfig
    {
        public int Columns { get; }
        public int[] ColumnHeights { get; }
        public int[] StartRows { get; }

        public BoardConfig(int columns, int[] columnHeights, int[] startRows)
        {
            Columns = columns;
            ColumnHeights = columnHeights;
            StartRows = startRows;
        }

        // Board configurations
        // Heights represent number of hexes in each column
        // StartRows represent the row offset for each column (0 = bottom)

        public static readonly BoardConfig Small = new BoardConfig(
            columns: 9,
            columnHeights: new[] { 5, 6, 7, 8, 9, 8, 7, 6, 5 },
            startRows: new[] { 3, 2, 2, 1, 1, 1, 2, 2, 3 }
        );

        public static readonly BoardConfig Medium = new BoardConfig(
            columns: 11,
            columnHeights: new[] { 4, 7, 8, 9, 10, 9, 10, 9, 8, 7, 4 },
            startRows: new[] { 4, 2, 2, 1, 1, 1, 1, 1, 2, 2, 4 }
        );

        public static readonly BoardConfig Large = new BoardConfig(
            columns: 13,
            columnHeights: new[] { 5, 8, 9, 10, 11, 10, 11, 10, 11, 10, 9, 8, 5 },
            startRows: new[] { 4, 2, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 4 }
        );

        public static BoardConfig GetConfig(BoardSize size)
        {
            switch (size)
            {
                case BoardSize.Small: return Small;
                case BoardSize.Large: return Large;
                case BoardSize.Medium:
                default: return Medium;
            }
        }
    }

    /// <summary>
    /// The game board with flat-top hexagonal grid.
    /// Handles board shape, valid positions, and leyline detection.
    /// </summary>
    public class Board
    {
        private readonly HashSet<HexCoord> _boardHexes;
        private readonly HashSet<HexCoord> _perimeterHexes;

        public BoardSize Size { get; }
        public int Columns { get; }

        public Board() : this(BoardSize.Medium) { }

        public Board(BoardSize size)
        {
            Size = size;
            _boardHexes = new HashSet<HexCoord>();
            _perimeterHexes = new HashSet<HexCoord>();

            var config = BoardConfig.GetConfig(size);
            Columns = config.Columns;
            InitializeBoard(config);
        }

        private void InitializeBoard(BoardConfig config)
        {
            // First pass: add all hexes
            for (int col = 0; col < config.Columns; col++)
            {
                int height = config.ColumnHeights[col];
                int rStart = config.StartRows[col];

                for (int row = 0; row < height; row++)
                {
                    _boardHexes.Add(new HexCoord(col, rStart + row));
                }
            }

            // Second pass: identify perimeter hexes
            foreach (var hex in _boardHexes)
            {
                if (IsOnPerimeter(hex))
                {
                    _perimeterHexes.Add(hex);
                }
            }
        }

        /// <summary>
        /// Checks if a hex is on the perimeter (has at least one neighbor off the board).
        /// </summary>
        private bool IsOnPerimeter(HexCoord coord)
        {
            foreach (var neighbor in coord.GetAllNeighbors())
            {
                if (!_boardHexes.Contains(neighbor))
                {
                    return true;
                }
            }
            return false;
        }

        public bool IsBoardHex(HexCoord coord)
        {
            return _boardHexes.Contains(coord);
        }

        /// <summary>
        /// Checks if a hex is on the perimeter (edge of board).
        /// </summary>
        public bool IsPerimeterHex(HexCoord coord)
        {
            return _perimeterHexes.Contains(coord);
        }

        /// <summary>
        /// Checks if a hex is an interior hex (not on perimeter).
        /// </summary>
        public bool IsInteriorHex(HexCoord coord)
        {
            return _boardHexes.Contains(coord) && !_perimeterHexes.Contains(coord);
        }

        public IEnumerable<HexCoord> BoardHexes => _boardHexes;

        public IEnumerable<HexCoord> PerimeterHexes => _perimeterHexes;

        public IEnumerable<HexCoord> InteriorHexes
        {
            get
            {
                foreach (var hex in _boardHexes)
                {
                    if (!_perimeterHexes.Contains(hex))
                    {
                        yield return hex;
                    }
                }
            }
        }

        public int HexCount => _boardHexes.Count;

        public int InteriorHexCount => _boardHexes.Count - _perimeterHexes.Count;

        /// <summary>
        /// Gets the center column of the board.
        /// </summary>
        public int CenterColumn => Columns / 2;

        /// <summary>
        /// Gets valid neighbors (only those within board bounds).
        /// </summary>
        public IEnumerable<HexCoord> GetValidNeighbors(HexCoord coord)
        {
            foreach (var neighbor in coord.GetAllNeighbors())
            {
                if (IsBoardHex(neighbor))
                {
                    yield return neighbor;
                }
            }
        }

        /// <summary>
        /// Gets all hexes in a straight line (leyline) from start in given direction.
        /// </summary>
        public List<HexCoord> GetLeyline(HexCoord start, int direction)
        {
            var result = new List<HexCoord>();
            var current = start.GetNeighbor(direction);

            while (IsBoardHex(current))
            {
                result.Add(current);
                current = current.GetNeighbor(direction);
            }

            return result;
        }
    }
}