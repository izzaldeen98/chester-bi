# Query Parsing Rules

## General Rules

All parsed values are returned as query-expression strings.

### Shared Operators

| Operator      |   Input | Output     |
| ------------- | ------: | ---------- |
| `is null`     |    none | `null`     |
| `is not null` |    none | `not null` |
| `equals`      | `input` | `=input`   |
| `not equals`  | `input` | `!=input`  |

---

# Number Fields

Number values should be parsed without quotes.

| Operator                 |              Input | Output                   |
| ------------------------ | -----------------: | ------------------------ |
| `between`                | `input1`, `input2` | `[input1 to input2]`     |
| `not between`            | `input1`, `input2` | `not [input1 to input2]` |
| `greater than`           |            `input` | `>input`                 |
| `greater than or equals` |            `input` | `>=input`                |
| `less than`              |            `input` | `<input`                 |
| `less than or equals`    |            `input` | `<=input`                |
| `equals`                 |            `input` | `=input`                 |
| `not equals`             |            `input` | `!=input`                |
| `is null`                |               none | `null`                   |
| `is not null`            |               none | `not null`               |

### Examples

```txt
between(10, 20)              -> [10 to 20]
not between(10, 20)          -> not [10 to 20]
greater than(100)            -> >100
greater than or equals(100)  -> >=100
less than(50)                -> <50
less than or equals(50)      -> <=50
equals(25)                   -> =25
not equals(25)               -> !=25
is null                      -> null
is not null                  -> not null
```

---

# String Fields

String parsing supports wildcard matching using `%`.

| Operator          |   Input | Output        |
| ----------------- | ------: | ------------- |
| `contains`        | `input` | `%input%`     |
| `not contains`    | `input` | `not %input%` |
| `starts with`     | `input` | `input%`      |
| `not starts with` | `input` | `not input%`  |
| `ends with`       | `input` | `%input`      |
| `not ends with`   | `input` | `not %input`  |
| `equals`          | `input` | `input`       |
| `not equals`      | `input` | `-input`      |
| `is null`         |    none | `null`        |
| `is not null`     |    none | `not null`    |
| `is empty`        |    none | `empty`       |
| `is not empty`    |    none | `-empty`      |

### Examples

```txt
contains(test)          -> %test%
not contains(test)      -> not %test%
starts with(test)       -> test%
not starts with(test)   -> not test%
ends with(test)         -> %test
not ends with(test)     -> not %test
equals(test)            -> test
not equals(test)        -> -test
is null                 -> null
is not null             -> not null
is empty                -> empty
is not empty            -> -empty
```

---

# Boolean Fields

Boolean values are parsed directly.

| Operator   | Input | Output  |
| ---------- | ----: | ------- |
| `is true`  |  none | `true`  |
| `is false` |  none | `false` |

### Examples

```txt
is true   -> true
is false  -> false
```

---

# Timestamp Fields

Timestamp values should use the following format:

```txt
yyyy-mm-dd hh:mm:ss
```

Example:

```txt
2026-06-21 14:30:00
```

---

## Timestamp: Relative Operators

Relative timestamp filters compare the selected field against a relative time expression.

| Operator |                Input | Output                       |
| -------- | -------------------: | ---------------------------- |
| `before` | `interval`, `amount` | `before amount interval ago` |
| `after`  | `interval`, `amount` | `after amount interval ago`  |

### Examples

```txt
before(day, 7)   -> before 7 day ago
after(day, 7)    -> after 7 day ago
before(month, 3) -> before 3 month ago
after(month, 3)  -> after 3 month ago
```

---

## Timestamp: Rolling Range Operators

Rolling ranges are used for dynamic time windows.

| Operator |                Input | Output                 |
| -------- | -------------------: | ---------------------- |
| `last`   | `interval`, `amount` | `last amount interval` |
| `next`   | `interval`, `amount` | `next amount interval` |

### Examples

```txt
last(day, 7)    -> last 7 day
last(month, 3)  -> last 3 month
next(day, 7)    -> next 7 day
next(month, 3)  -> next 3 month
```

---

## Timestamp: Absolute Operators

Absolute timestamp filters use fixed timestamp values.

| Operator      |                      Input | Output                         |
| ------------- | -------------------------: | ------------------------------ |
| `before`      |                `timestamp` | `before timestamp`             |
| `after`       |                `timestamp` | `after timestamp`              |
| `equals`      |                `timestamp` | `timestamp`                    |
| `not equals`  |                `timestamp` | `not timestamp`                |
| `between`     | `timestamp1`, `timestamp2` | `timestamp1 to timestamp2`     |
| `not between` | `timestamp1`, `timestamp2` | `not timestamp1 to timestamp2` |
| `is null`     |                       none | `null`                         |
| `is not null` |                       none | `not null`                     |

### Examples

```txt
before(2026-06-21 14:30:00)
-> before 2026-06-21 14:30:00

after(2026-06-21 14:30:00)
-> after 2026-06-21 14:30:00

equals(2026-06-21 14:30:00)
-> 2026-06-21 14:30:00

not equals(2026-06-21 14:30:00)
-> not 2026-06-21 14:30:00

between(2026-06-21 10:00:00, 2026-06-21 18:00:00)
-> 2026-06-21 10:00:00 to 2026-06-21 18:00:00

not between(2026-06-21 10:00:00, 2026-06-21 18:00:00)
-> not 2026-06-21 10:00:00 to 2026-06-21 18:00:00

is null
-> null

is not null
-> not null
```

---

# Supported Intervals

Timestamp relative and rolling operators support the following intervals:

```txt
minute
hour
day
week
month
quarter
year
```

---

# Notes

1. Number fields use comparison syntax such as `>`, `>=`, `<`, and `<=`.
2. String fields use `%` as a wildcard for pattern matching.
3. Timestamp fields should be normalized to `yyyy-mm-dd hh:mm:ss`.
4. `datetime-local` inputs should be converted from `yyyy-mm-ddThh:mm` to `yyyy-mm-dd hh:mm:ss`.
5. `between` values should always preserve the order: start value first, end value second.
