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
    /// The 92-hex game board with flat-top hexagonal grid.
    /// Handles board shape, valid positions, and leyline detection.
    /// </summary>
    public class Board
    {
        private readonly HashSet<HexCoord> _boardHexes;

        // Board dimensions (13 columns x variable rows = 92 hexes)
        public const int Columns = 11;

        public Board()
        {
            _boardHexes = new HashSet<HexCoord>();
            InitializeBoard();
        }

        private void InitializeBoard()
        {
            // Column heights: 5,8,9,10,9,10,9,10,9,8,5
            // StartRows: where each column begins (row 0 = bottom)
            int[] columnHeights = { 5, 8, 9, 10, 9, 10, 9, 10, 9, 8, 5 };
            int[] startRows = { 3, 1, 1, 0, 1, 0, 1, 0, 1, 1, 3 };

            for (int col = 0; col < Columns; col++)
            {
                int height = columnHeights[col];
                int rStart = startRows[col];

                for (int row = 0; row < height; row++)
                {
                    _boardHexes.Add(new HexCoord(col, rStart + row));
                }
            }
        }

        public bool IsBoardHex(HexCoord coord)
        {
            return _boardHexes.Contains(coord);
        }

        public IEnumerable<HexCoord> BoardHexes => _boardHexes;

        public int HexCount => _boardHexes.Count;

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