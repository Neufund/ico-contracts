% Report: Curve Derivation


$$
\newcommand{\e}{\mathrm{e}}
\newcommand{\code}[1]{\mathtt{#1}}
\newcommand{\par}[1]{\left( #1 \right)}
\newcommand{\ceil}[1]{\left\lceil #1 \right\rceil}
\newcommand{\floor}[1]{\left\lfloor #1 \right\rfloor}
\newcommand{\mod}[2]{\left[ #1 \right]_{#2}}
\newcommand{\exp}[1]{\mathrm{exp}\par{#1}}
\newcommand{\ln}[1]{\mathrm{ln}\par{#1}}
$$

## Exponential issuances curves

A generic exponential issuance curve looks like

$$
\code{issued} =
 \code{cap}·\par{
  1 - \exp{
    -\frac{\code{price}_0}{\code{cap}} · \code{invested} }
}
$$

where $\code{price}_0$ is the initial token price, $\code{cap}$ is the maximum amount of tokens that will ever be issued. The derivative of this, the price, is:

$$
\code{price} = \code{price}_0·\exp{-\frac{\code{price}_0}{\code{cap}} · \code{invested} }
$$

It is easy to see that the the $\code{price} = \code{price}_0$ when $\code{invested} = 0$ as expected.

As the cap is approached asymptotically, it will never be reached. We can instead compute when more than $99\%$ of the tokens are issued. For this we solve

$$
\exp{ -\frac{\code{price}_0}{\code{cap}} · \code{invested} } < 0.01
$$

and the solution is

$$
\code{invested} > -\frac{\code{cap}}{\code{price}_0} · \ln{0.01}
$$

where $\ln{0.01} ≈ -4.6$.

In Ethereum smart contract code token amounts are scaled to accomodate fractional amounts. The scaling is generally by large power of ten like $10^{18}$. Let's say the issued token is scaled by $S_{\code{issued}}$ and the invested token by $S_{\code{invested}}$, then amount of issued tokens in the unit of least precision, $\code{issued\_ulp}$, is

$$
S_{\code{issued}} · \code{cap}·\par{
  1 - \exp{
    -\frac{\code{price}_0}{\code{cap}} · \frac{\code{invested\_ulp} }{S_{\code{invested}}} }
}
$$

where $\code{invested\_ulp}$ is the scaled invested token in units of least precision.

In Neufund's case, the invested token is the Euro token (or is converted to equivalent amount) and the issued token is the Neumark. The parameters for the issuance are:

Parameter            Value        Units
-------------------  -----------  ----------------
$\code{cap}$         $1.5·10^9$   Neumark
$\code{price}_0$     $6.5$        Neumark per Euro
$S_\code{issued}$    $10^{18}$    ULP per Neumark
$S_\code{invested}$  $10^{18}$    ULP per Euro


## Applying the binomial theorem

The Binomial theorem states that

$$
\par{a + b}^n = \sum_{i \in [0,n]} {n \choose i} · a^k · b^{n-i}
$$

where the Binomial coefficient ${n \choose i}$ is $\frac{n!}{i!·\par{n-i}!}$. To apply this, we first need to massage our exponential in the shape of

$$
\par{1 - \frac 1 D}^n
$$

where $D$ is a constants, and $n = \code{invested\_ulp} ∈ ℕ$. By maninpulating the issuance curve we can find that

$$
D = \par{1 - \exp{-\frac{\code{price}_0}{\code{cap} · S_{\code{invested}}} }}^{-1}
\mathrm{\,.}
$$

By further setting $C = \code{cap} · S_{\code{issued}}$ we can rewrite the full equation as

$$
\code{issued\_ulp} = C - C · \par{1 - \frac 1 D}^n
$$

Applying the Binomial theorem to the $\par{1 - \frac 1 D}^n$ term, we get

$$
\par{1 - \frac 1 D}^n
= \sum_{i \in [0, n]} \frac{n!}{i!\par{n - i}!} \par{- \frac 1 D}^k
$$

The terms of this sum proceed as

$$
1
- \frac{n}{D}
+ \frac{n\par{n - 1}}{2 · D^2}
- \frac{n\par{n - 1}\par{n - 2}}{6 · D^3}
+ …
$$

The sum does not go on indefinitely, at some point we reach $\par{n - n}$ in the numerator and all future terms will be zero. At this point we can stop the summation.

Let's look at the individual terms in this sum, they satisfy a nice recurrence relation:

$$
\begin{align}
\code{term}_0 &= 1 &
\code{term}_{i+1} &= \frac{n - i}{\par{i + 1} · D} · \code{term}_i \\
\end{align}
$$

The sum itself also has a recurence relation,

$$
\begin{align}
\code{sum}_0 &= 1 &
\code{sum}_{i+1} &= \code{sum}_i ∓ \code{term}_{i + 1} \\
\end{align}
$$

We can optimize this further by realizing that $\par{i + 1} · D$ is simply the sequence $D, 2D, 3D, …$. We can generate this sequence with a additional simple recurence, which will safe us a multiply operation:

$$
\begin{align}
\code{term}_0 &= 1 &
\code{term}_{i+1} &= \code{term}_i · \frac{n - i}{\code{denom}_i}\\
\code{sum}_0 &= 1 &
\code{sum}_{i+1} &= \code{sum}_i ∓ \code{term}_{i + 1} \\
\code{denom}_0 &= D &
\code{denom}_{i+1} &= \code{denom}_i + D \\
\end{align}
$$

We are not just interested in our exponent, but we would like the whole  $\code{issued\_ulp} = C - C · \code{sum}_n$. This equation can be folded into the initial conditions, like so

$$
\begin{align}
\code{term}_0 &= C &
\code{term}_{i+1} &= \code{term}_i · \frac{n - i}{\code{denom}_i} \\
\code{sum}_0 &= 0 &
\code{sum}_{i+1} &= \code{sum}_i ± \code{term}_{i + 1} \\
\code{denom}_0 &= D &
\code{denom}_{i+1} &= \code{denom}_i + D \\
\end{align}
$$

With these recurences, we can already build a simple algorithm in a language with floating points such as Python:

```python
import math
C = 1.5 * 10**9 * 10**18
D = -1 / math.expm1(-6.5 / C)

def issuance(n):
    '''Computes C - C·(1 - 1/D)**n using the Binomial theorem'''
    global C, D
    term = C
    sum = 0
    denom = D
    i = 0
    while True:
        term *= (n - i) / denom;
        if term == 0:
            break
        sum += term if i % 2 == 0 else -term
        denom += D
        i += 1
    return sum
```


## Integer approximation

To start let's look at the size of the numbers we are working with. $C$ is exactly $1.5·10^{27}$ Neumark ULPs. This is already an integer and $\log_2 C ≈ 90$ so it fits comfortably in a 256 bit register. $D$, rounded to the nearest integer, is

$$
D = 230\,769\,230\,769\,230\,769\,230\,769\,231 + O\par{½}
$$

which has $\log_2 D ≈ 88$ bits. This number is an approximation, and the error is $≤ \frac 12$ because of the rounding. On first look, this should give us about 88 bits, or 26 decimals, of precision. With $n$ up to 10 billion Euro, or $10^{28}$ Euro ULPs, this should can induce an error of $100$ Euro ULPs, or $10^{-16}$ Euros, a rather insignificant amount. In fact, assuming a 300 Euro screen with a lifetime of four years, the number is not even worth the pixels to display it.

These numbers look great already, so we can probably use them as is. If it turns out that $D$ was too small, and we need more digits for precision, we could boost the precision by first scaling $n$ by a factor, like so:

$$
\par{1 - \frac 1 {D'}}^{K · n}
$$

The resulting $D'$ will be larger by about a factor $K$. It is also notable that our $D$ approximation has a repeating pattern. This suggests a rational number. In this case, it appears that $D$ is very close to, $\frac{3}{13}·10^{27}$. This is because, to a first approximation, $(1 - \e^{-x})^{-1}$ is $\frac 1 2 + \frac 1 x + O(x)$ and the $\frac 1 x$ term dominates the others. We could use this fact if a simple fraction for $D$ is easier. In architectures where small multiplies can be implemented using shifts and adds, this is an advantages. Ethereum does not have shifts, so it does not matter here.

$$
\begin{align}
\code{term}_0 &= C &
\code{term}_{i+1} &= \floor{\frac{\code{term}_i ·\par{n - i}}{\code{denom}_i}} \\
\code{sum}_0 &= 0 &
\code{sum}_{i+1} &= \code{sum}_i ± \code{term}_{i + 1} \\
\code{denom}_0 &= D &
\code{denom}_{i+1} &= \code{denom}_i + D \\
\end{align}
$$


### Stopping the sum early

When $\code{term}_i < 1$ it will be rounded down to zero and all further terms will be zero. This will happen after only a few terms, long before $i$ gets close to $n$. $\code{term}_i$ starts at $C$ and at every step gets multiplied by at most $n$ and then divided by at least $D$. We would therefore expect it to become insignificant before

$$
C · \par{\frac n D}^i < 1
\mathrm{\,,}
$$

which, solving for $i$, gives

$$
i < \frac{\log C}{\log D - \log n} ≈ - \frac{63}{61 - \log n}
\mathrm{\,.}
$$

This is function initially grows extremely slow in $n$, staying below $2$ for $n$ below $10^{12}$, below $10$ for $n < 10^{23}$, but then it takes off to infinity when $n = D ≈ 10^{26}$. This is not true however, in our approximation we have left out the $i!$ term in the divisor. Including this term will make an analytical solution very hard, even if we use the Stirling approximation.

Empirically, we determine that only $20$ terms are significant when $n = 10^{26}$. At $n ≈ 10^{28}$ this increases to $168$. At this point, the $\code{issued\_ulp}$ is within $10^{-9}$ Neumark of the final value. We can thus stop the calculation and accept this insignificant error. After more experimentation, an more fine-tuned limit was established:

Parameter         Value        Units
----------------- ------------ ----------
$n_{\code{lim}}$  $83·10^{26}$ Euro ULPs

When $n$ is above this limit, we will immediately return the asymptotic value $C$.

### Optimizations

We now know that $i < 168$ and thus much less than $n$ for all interesting values of $n$. From this the $n - i$ term can be approximated with just $n$. We save a subtraction and no longer have to keep track of $i$, saving more instructions. The recurence relation becomes

$$
\begin{align}
\code{term}_0 &= C &
\code{term}_{i+1} &= \floor{\frac{\code{term}_i ·n}{\code{denom}_i}} \\
\code{sum}_0 &= 0 &
\code{sum}_{i+1} &= \code{sum}_i ± \code{term}_{i + 1} \\
\code{denom}_0 &= D &
\code{denom}_{i+1} &= \code{denom}_i + D
\mathrm{\,.}
\end{align}
$$

As a final optimization, we unroll the loop one time so we can inline the $±$  and save half of the loop overhead. Again in Python:

```python
C     = 1500000000000000000000000000
D     =  230769230769230769230769231
n_lim = 8300000000000000000000000000

def issuance(n):
    '''Computes C - C·(1 - 1/D)**n using the Binomial theorem'''
    global C, D
    if n >= n_lim:
        return C
    term  = C
    sum   = 0
    denom = D
    while term != 0:
        term  *= n
        term //= denom;
        sum   += term
        denom += D
        term  *= n
        term //= denom;
        sum   -= term
        denom += D
    return sum
```

We could add an early exit in the middle for `term == 0`. After some experiments, it turns out to be disadvantageous. Evaluating the conditional over and over cost more gas then evaluating an extra term.

### Solidity

We are now ready to implement the algorithm in Solidity. We use assembly for `div` because the the regular integer division (this `/` operator) includes a costly and uneccesary division-by-zero check.

```javascript
function curve(uint256 n)
    public
    constant
    returns(uint256)
{
    uint256 C     = 1500000000000000000000000000;
    uint256 D     =  230769230769230769230769231;
    uint256 n_lim = 8300000000000000000000000000;
    if(n >= n_lim) {
        return C;
    }
    uint256 term = C;
    uint256 sum = 0;
    uint256 denom = D;
    assembly {
        repeat:
            term  := div(mul(term, n), denom)
            sum   := add(sum, term)
            denom := add(denom, D)
            term  := div(mul(term, n), denom)
            sum   := sub(sum, term)
            denom := add(denom, D)
            jumpi (repeat, term)
    }
    return sum;
}
```

## Proof of correctness

### Lemma 0: The terms grow monotonically with n.

$$
\code{term}_i(n) ≤ \code{term}_i(n + 1)
$$

### Lemma 1: The terms are smaller than .


**Proof**: We run $\code{term}_i(n_\code{lim} - 1)$



### Lemma 1: There is no overflow

$\code{term}_{i}$ has its maximum value when $\frac n {i · D} = 1$, thus $i = i_\code{max} = \floor{\frac n D}$. The value is

$$
\code{term}_{i_\code{max}}
≤ C · \prod_{i ∈ [1, i_\code{max}]} \frac n {i · D}
= C · \par{\frac n D}^{i_\code{max}} · \frac 1 {i_\code{max} !}
$$

The factorial has an upper bound from the [Stirling approximation][stirling]:

$$
n! ≤ \e · n^{n + ½} · \e^{-n}
$$

[stirling]: https://en.wikipedia.org/wiki/Stirling%27s_approximation#Speed_of_convergence_and_error_estimates



### Lemma 2: The algorithm always stops

### Lemma 3: The function is monotonic
