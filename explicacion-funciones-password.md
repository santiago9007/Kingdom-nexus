# Explicación de las funciones de contraseña

Este documento explica las funciones `getRandomCharacter` y `shufflePassword` del archivo `js/register.js`.

## 1. `getRandomCharacter`

```javascript
function getRandomCharacter(characters) {
  const array = new Uint32Array(1);

  crypto.getRandomValues(array);

  return characters[array[0] % characters.length];
}
```

### ¿Qué hace?

Selecciona y devuelve un carácter aleatorio de una cadena de caracteres.

### Paso a paso

1. Recibe una cadena mediante el parámetro `characters`.
2. Crea un arreglo numérico con un solo espacio:

   ```javascript
   const array = new Uint32Array(1);
   ```

3. `crypto.getRandomValues(array)` llena el arreglo con un número aleatorio seguro para usos relacionados con seguridad.
4. El operador `%` obtiene el resto de una división. Ese resto siempre queda dentro del rango de posiciones disponibles en la cadena.
5. Devuelve el carácter que está en esa posición.

### Ejemplo

```javascript
const numbers = "0123456789";
const result = getRandomCharacter(numbers);
```

Si el número aleatorio generado fuera `27`, el cálculo sería:

```javascript
27 % 10; // 7
```

Como la cadena tiene 10 caracteres y la posición `7` contiene el carácter `"7"`, el resultado sería:

```javascript
"7";
```

El resultado real puede ser cualquier carácter de `"0123456789"`.

### Otro ejemplo

```javascript
const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
getRandomCharacter(uppercase);
```

Esta llamada devuelve una sola letra mayúscula, por ejemplo `"G"` o `"T"`.

---

## 2. `shufflePassword`

```javascript
function shufflePassword(password) {
  const characters = password.split("");

  const array = new Uint32Array(characters.length);

  crypto.getRandomValues(array);

  for (let i = characters.length - 1; i > 0; i--) {
    const randomIndex = array[i] % (i + 1);

    [characters[i], characters[randomIndex]] = [
      characters[randomIndex],
      characters[i],
    ];
  }

  return characters.join("");
}
```

### ¿Qué hace?

Cambia aleatoriamente el orden de los caracteres de una contraseña.

La función no cambia los caracteres ni su cantidad; únicamente modifica sus posiciones.

### Paso a paso

1. Convierte la cadena en un arreglo:

   ```javascript
   "Ab3!xyz".split("");
   // ["A", "b", "3", "!", "x", "y", "z"]
   ```

2. Crea un arreglo numérico con la misma cantidad de espacios que caracteres tiene la contraseña.
3. Lo llena con valores aleatorios usando `crypto.getRandomValues`.
4. Recorre el arreglo desde el último carácter hasta el segundo.
5. Para cada posición, calcula otra posición aleatoria.
6. Intercambia los dos caracteres.
7. Convierte el arreglo nuevamente en una cadena con `join("")`.

### Ejemplo sencillo

```javascript
const password = "Ab3!xyz";
const result = shufflePassword(password);
```

Un posible resultado sería:

```javascript
"3yA!xbz";
```

Otro resultado posible sería:

```javascript
"!z3bAxy";
```

Cada ejecución puede producir un orden diferente, pero siempre conservará los mismos caracteres:

```text
Entrada:  A b 3 ! x y z
Salida:   3 y A ! x b z
```

### ¿Cómo funciona el intercambio?

Esta parte:

```javascript
[characters[i], characters[randomIndex]] = [
  characters[randomIndex],
  characters[i],
];
```

intercambia dos valores sin necesitar una variable temporal.

Por ejemplo, si tenemos:

```javascript
characters[i] = "A";
characters[randomIndex] = "3";
```

después del intercambio quedan así:

```javascript
characters[i] = "3";
characters[randomIndex] = "A";
```

---

## 3. Cómo trabajan juntas

En `createPassword`, primero se genera una contraseña que contiene al menos:

- Una letra mayúscula.
- Una letra minúscula.
- Un número.
- Un carácter especial.

Por ejemplo, antes de mezclar podría quedar así:

```javascript
"Ab3!kP7xM2qZ";
```

Después se llama a:

```javascript
password = shufflePassword(password);
```

Y podría transformarse en:

```javascript
"7q!MxAbZ2Pk3";
```

La mezcla evita que los primeros cuatro caracteres siempre indiquen dónde están la mayúscula, la minúscula, el número y el carácter especial.

En resumen:

```text
getRandomCharacter -> elige un carácter aleatorio
shufflePassword    -> cambia aleatoriamente el orden de una contraseña
```
