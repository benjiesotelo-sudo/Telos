# Deterministic fixture for the Association spike. RNG stream order is load-bearing.
set.seed(42)
n <- 40
x <- round(rnorm(n, 50, 10), 1)
y <- round(0.6 * x + rnorm(n, 10, 8), 1)
ord1 <- sample(1:5, n, replace = TRUE)
ord2 <- pmin(5, pmax(1, ord1 + sample(-1:1, n, replace = TRUE)))
cat3 <- sample(c('alpha', 'beta', 'gamma'), n, replace = TRUE)
cat3b <- sample(c('high', 'low', 'mid'), n, replace = TRUE)
bin1 <- sample(c('no', 'yes'), n, replace = TRUE)
bin2 <- sample(c('fail', 'pass'), n, replace = TRUE)
d <- data.frame(x, y, ord1, ord2, cat3, cat3b, bin1, bin2)
write.csv(d, '/tmp/assoc-spike/fixture.csv', row.names = FALSE)
