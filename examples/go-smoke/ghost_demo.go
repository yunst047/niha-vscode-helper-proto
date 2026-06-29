package main

import "fmt"

// fibonacci returns the n-th Fibonacci number (recursive).
func fibonacci(n int) int {
	if n < 2 {
		return n
	}
	// GHOST SPOT 1: put the cursor at the END of the next line (after "return fib")
	// and wait ~0.5s. Koyuki should ghost-suggest: onacci(n-1) + fibonacci(n-2)
	return fib
}

// reverse returns s with its runes in reverse order.
func reverse(s string) string {
	runes := []rune(s)
	for i, j := 0, len(runes)-1; i < j; i, j = i+1, j-1 {
		// GHOST SPOT 2: cursor on the blank line below, indented — it should
		// suggest the swap: runes[i], runes[j] = runes[j], runes[i]

	}
	return string(runes)
}

func main() {
	fmt.Println(fibonacci(10))
	fmt.Println(reverse("koyuki"))
	// GHOST SPOT 3: start typing `for i := ` on the next line and let it finish a loop

}
