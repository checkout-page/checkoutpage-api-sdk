use std::time::Duration;

#[derive(Debug, Clone)]
pub struct Backoff {
    unit: Duration,
    attempt: u32,
}

const CAP_UNITS: u32 = 30;

impl Backoff {
    pub fn new(unit: Duration) -> Self {
        Backoff { unit, attempt: 0 }
    }

    pub fn next_delay(&mut self) -> Duration {
        let units = 2u32.saturating_pow(self.attempt).min(CAP_UNITS);
        self.attempt = self.attempt.saturating_add(1);
        self.unit * units
    }

    pub fn reset(&mut self) {
        self.attempt = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn doubles_from_one_second_to_a_thirty_second_cap() {
        let mut b = Backoff::new(Duration::from_secs(1));
        let secs: Vec<u64> = (0..8).map(|_| b.next_delay().as_secs()).collect();
        assert_eq!(secs, [1, 2, 4, 8, 16, 30, 30, 30]);
    }

    #[test]
    fn reset_starts_over() {
        let mut b = Backoff::new(Duration::from_secs(1));
        b.next_delay();
        b.next_delay();
        b.reset();
        assert_eq!(b.next_delay(), Duration::from_secs(1));
    }

    #[test]
    fn scales_with_unit_and_never_overflows() {
        let mut b = Backoff::new(Duration::from_millis(10));
        assert_eq!(b.next_delay(), Duration::from_millis(10));
        assert_eq!(b.next_delay(), Duration::from_millis(20));
        for _ in 0..100 {
            b.next_delay();
        }
        assert_eq!(b.next_delay(), Duration::from_millis(300));
    }
}
